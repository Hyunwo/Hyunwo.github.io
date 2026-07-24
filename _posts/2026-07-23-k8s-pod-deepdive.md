---
layout: post
title: "Pod 심화: 멀티 컨테이너, 라벨, 노드 스케줄링, 리소스 제한"
date: 2026-07-23
tags: [kubernetes, infra]
---

어제 클러스터랑 네임스페이스 개념을 정리했는데, 오늘은 Pod 안쪽을 더 자세히 들여다보는 내용이었다. 한 Pod에 컨테이너가 여러 개 들어갈 때 어떻게 동작하는지, 라벨은 왜 다는지, Pod가 어느 노드에 배치되는지까지.

## 한 Pod 안의 여러 컨테이너

Pod 안에는 하나의 독립적인 서비스를 구동하는 컨테이너가 들어간다. 컨테이너는 포트를 하나 이상 가질 수 있는데, **같은 Pod 안에서는 컨테이너끼리 포트가 겹칠 수 없다.**

![Pod 안의 여러 컨테이너]({{ site.baseurl }}/assets/images/k8s-pod-deepdive/pod_multi_container.png)

이유는 같은 Pod 안의 컨테이너들이 **하나의 네트워크(호스트)를 공유**하기 때문이다. 그래서 컨테이너 하나에서 다른 컨테이너로 갈 때는 `localhost:포트번호`로 바로 접근할 수 있다.

이걸 YAML로 표현하면 이런 식이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-1
spec:
  containers:
    - name: container1
      image: p8000
      ports:
        - containerPort: 8000
    - name: container2
      image: p8080
      ports:
        - containerPort: 8080
```

### Pod의 IP는 휘발성이다

Pod가 생성되면 고유 IP가 할당되는데, 이 IP는 **클러스터 내부에서만** 접근 가능하고 외부에서는 접근할 수 없다. 그리고 Pod에 문제가 생겨서 재생성되면 IP가 바뀐다. 그래서 Pod IP는 "휘발성이 있다"고 표현한다. (그래서 앞서 정리한 것처럼 고정 주소가 필요하면 Service를 앞에 둬야 한다.)

---

## 라벨: 오브젝트에 붙이는 해시태그

**라벨(Label)**은 Pod뿐만 아니라 모든 오브젝트에 달 수 있는데, 실제로는 Pod에서 제일 많이 쓰인다. key-value 한 쌍이 라벨 하나고, 한 오브젝트에 여러 개를 달 수 있다.

라벨을 다는 이유는 목적에 따라 오브젝트를 분류해두고, 나중에 그 분류만 골라서 연결하기 위해서다. 해시태그로 검색하듯이, 원하는 라벨이 붙은 Pod만 골라서 쓸 수 있는 셈이다.

![Label과 Selector]({{ site.baseurl }}/assets/images/k8s-pod-deepdive/label_selector.png)

Pod에 라벨을 이렇게 달아두고,

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
  labels:
    app: web
spec:
  containers:
    - name: web
      image: my-web-app
```

Service를 만들 때 selector에 같은 key-value를 넣으면, 그 라벨이 붙은 Pod에만 연결된다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
```

---

## Pod는 어느 노드에 올라갈까: 수동 vs 자동

Pod는 결국 여러 Node 중 하나에 배치돼야 한다. 방법은 두 가지다.

### 1. 직접 노드를 지정하는 방법 (nodeSelector)

Pod에 라벨을 다는 것처럼, 이번엔 노드에 라벨을 달아두고 Pod를 만들 때 그 노드를 지정할 수 있다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-on-specific-node
spec:
  nodeSelector:
    disktype: ssd
  containers:
    - name: app
      image: my-app
```

### 2. 스케줄러가 자동으로 판단하는 방법

Node에는 사용 가능한 자원량(메모리, CPU 등)이 있다. Pod를 만들 때 이 Pod가 요구하는 자원량을 명시해두면, 쿠버네티스 스케줄러가 알아서 여유가 있는 노드에 배치해준다.

![스케줄러의 자동 배치]({{ site.baseurl }}/assets/images/k8s-pod-deepdive/node_scheduling.png)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-with-resources
spec:
  containers:
    - name: app
      image: my-app
      resources:
        requests:
          memory: "2Gi"
        limits:
          memory: "3Gi"
```

이 예시는 "이 Pod는 최소 2GB의 메모리가 필요하고(request), 최대 3GB까지만 쓸 수 있다(limit)"는 뜻이다.

이 값을 설정하지 않으면, Pod 안 앱에 부하가 생겼을 때 그 Pod가 노드의 자원을 무한정 쓰려고 할 수 있고, 그러면 같은 노드에 있는 다른 Pod들이 자원을 못 받아서 같이 죽어버릴 수 있다. request/limit은 이런 상황을 막아주는 안전장치인 셈이다.

### 메모리 초과 vs CPU 초과, 처리 방식이 다르다

리밋을 넘겼을 때 메모리와 CPU는 서로 다르게 반응한다.

| 자원 | limit 초과 시 동작 |
|---|---|
| **메모리** | Pod를 바로 종료시킴 |
| **CPU** | 종료시키지 않고, 대신 느려짐(스로틀링) |

이렇게 다른 이유는 자원의 성격 차이 때문이다. CPU는 여러 프로세스가 나눠 쓰다 보면 그냥 느려질 뿐이지 서로 망가뜨리진 않는다. 반면 메모리는 다른 프로세스의 영역을 침범하면 치명적인 문제(잘못된 메모리 참조로 인한 강제 종료 등)로 이어질 수 있어서, 쿠버네티스도 메모리 초과는 더 엄격하게 다룬다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Label** | 오브젝트에 붙이는 key-value 쌍. 분류와 선택(selector 매칭) 용도로 사용 |
| **Selector** | 특정 라벨을 가진 오브젝트만 골라 연결할 때 쓰는 조건 |
| **nodeSelector** | Pod를 특정 라벨이 붙은 Node에 직접 배치하도록 지정하는 필드 |
| **Scheduler** | Pod가 요구하는 자원량을 보고 적절한 Node에 자동으로 배치해주는 컴포넌트 |
| **requests** | Pod(컨테이너)가 최소한으로 필요로 하는 자원량. 스케줄링 기준이 됨 |
| **limits** | Pod(컨테이너)가 최대로 쓸 수 있는 자원량. 초과 시 처리 방식은 자원 종류에 따라 다름 |

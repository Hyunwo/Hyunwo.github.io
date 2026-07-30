---
layout: post
title: "Controller 개요와 ReplicationController, ReplicaSet"
date: 2026-07-29
tags: [kubernetes, infra]
categories: [kubernetes]
---

오늘부터는 Controller를 다룬다. 먼저 Controller가 전반적으로 왜 필요한지 훑고, 그다음 가장 기본이 되는 ReplicationController와 ReplicaSet을 정리한다.

## Controller가 제공하는 4가지 기능

Controller는 서비스를 안정적으로 운영하는 데 필요한 기능들을 제공한다.

- **Self-healing**: Pod가 갑자기 죽거나, Pod가 떠 있던 Node 자체가 죽으면 즉시 감지해서 다른 Node에 Pod를 새로 만들어준다
- **Auto-scaling**: 부하가 몰려서 자원이 부족해지면 Pod를 늘려서 부하를 분산시킨다
- **롤링 업데이트 / 롤백**: 여러 Pod의 버전을 한 번에 업그레이드하고, 문제가 생기면 롤백할 수 있다
- **일회성 작업 처리**: 필요한 순간에만 Pod를 만들어 작업을 처리하고, 끝나면 삭제해서 자원을 돌려준다

여기서 하나 정확히 짚고 갈 부분이 있다. **Auto-scaling은 ReplicaSet 자체에 내장된 기능이 아니다.** ReplicaSet은 정해진 `replicas` 수를 유지해줄 뿐이고, 리소스 사용량을 보고 그 수를 자동으로 늘리거나 줄여주는 건 **HorizontalPodAutoscaler(HPA)**라는 별도 오브젝트의 역할이다. HPA가 지표를 보고 ReplicaSet(또는 Deployment)의 `replicas` 값을 조정해주는 방식으로 동작한다.

쿠버네티스의 여러 오브젝트가 이런 Controller 역할을 나눠 맡고 있는데, 오늘은 그중 가장 기본이 되는 ReplicationController와 ReplicaSet을 다룬다.

---

## ReplicationController와 ReplicaSet

**ReplicationController**는 현재 Deprecated된 오브젝트이고, 대신 쓰는 게 **ReplicaSet**이다.

### Template: Pod가 죽으면 이 내용으로 재생성

Controller와 Pod는 Service와 Pod처럼 **Label-Selector**로 연결된다. Controller를 만들 때는 Pod의 내용을 **template**으로 함께 넣어두는데, Pod가 죽으면 Controller가 이 template 내용으로 Pod를 다시 만들어준다.

![Controller의 template으로 Pod 재생성]({{ site.baseurl }}/assets/images/k8s-controller-basics/controller_template.png)

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: web-rc
spec:
  replicas: 1
  selector:
    app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: my-web:v1
```

이 특성을 이용하면 수동으로 버전 업그레이드도 할 수 있다. template의 image를 `v2`로 바꾸고, 기존에 떠 있던 Pod를 지우면 Controller가 template을 기반으로 Pod를 재생성하면서 새 버전으로 바뀐다. (참고로 롤링 업데이트처럼 자동으로 순차 교체해주는 기능은 아니고, 기존 Pod를 지워야 새 버전으로 재생성되는 수동 방식이다. 자동 롤링 업데이트는 Deployment의 역할이다.)

template에 들어가는 Pod 스펙에도 반드시 라벨을 지정해둬야, 새로 만들어질 때 Controller의 selector와 연결된다.

### replicas: Pod 개수 유지와 Scale Out/In

ReplicaSet은 `replicas`에 지정한 만큼 Pod 개수를 유지해준다. Pod 하나가 삭제되면 하나만 다시 만들어주고, `replicas` 값을 3으로 늘리면 그 수만큼 Pod가 늘어나며 **Scale Out**된다. 반대로 값을 낮추면 **Scale In**된다.

![replicas로 Scale Out/In]({{ site.baseurl }}/assets/images/k8s-controller-basics/replicaset_scale.png)

template과 replicas 기능을 함께 쓰면, Pod를 따로 만들지 않고 Controller 정의 하나만으로 Pod까지 한 번에 만들 수 있다. 연결된 Pod가 없는 상태에서 Controller를 만들면, template 내용으로 `replicas`에 지정된 수만큼 Pod가 새로 만들어진다. 실무에서도 보통 Pod를 따로 만들지 않고 이렇게 Controller(정확히는 상위 오브젝트인 Deployment) 정의만 만들어서 사용한다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: my-web:v1
```

---

## Selector: ReplicaSet에만 있는 확장 기능

지금까지 다룬 template, replicas 기능은 ReplicaSet에도 똑같이 있는 기능이고, 여기서부터가 ReplicaSet만의 차별점이다.

**ReplicationController**의 selector는 key와 value가 모두 같은 Pod만 연결한다. 하나라도 다르면 연결되지 않는 단순한 방식이다.

**ReplicaSet**의 selector에는 두 가지 속성이 있다.

- **matchLabels**: ReplicationController의 selector와 동일하게, key-value가 모두 일치해야 연결
- **matchExpressions**: key와 value를 좀 더 세밀하게 조건화할 수 있는 방식

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
    matchExpressions:
      - key: ver
        operator: Exists
  template:
    metadata:
      labels:
        app: web
        ver: v2
    spec:
      containers:
        - name: web
          image: my-web:v2
```

`matchExpressions`에서 쓸 수 있는 operator는 4가지다.

| Operator | 의미 |
|---|---|
| **Exists** | key만 지정하면, value와 상관없이 그 key를 가진 모든 Pod를 선택 |
| **DoesNotExist** | 지정한 key를 가지고 있지 **않은** Pod만 선택 |
| **In** | key의 value가 지정한 values 목록 안에 있는 Pod를 선택 |
| **NotIn** | key의 value가 지정한 values 목록에 없는 Pod를 선택 |

**NotIn**은 한 가지 보충할 부분이 있다. "key는 있는데 value가 목록에 없는 Pod"만 고르는 게 아니라, **그 key 자체가 아예 없는 Pod까지 함께 선택**된다. 예를 들어 `key: a, operator: NotIn, values: [2, 3]`이면, key `a`의 value가 2나 3이 아닌 Pod뿐 아니라 애초에 key `a`가 없는 Pod도 전부 선택 대상에 포함된다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **ReplicationController** | Pod 개수를 유지해주는 가장 기본적인 Controller. 현재는 Deprecated |
| **ReplicaSet** | ReplicationController를 대체하는 오브젝트. template, replicas 기능은 동일하고 matchExpressions 같은 확장된 selector를 지원 |
| **template** | Controller에 포함되는 Pod 스펙. Pod가 죽으면 이 내용으로 재생성됨 |
| **replicas** | Controller가 유지해야 할 Pod 개수. 값을 바꾸면 Scale Out/In됨 |
| **matchLabels** | key-value가 정확히 일치하는 Pod만 선택하는 selector 방식 |
| **matchExpressions** | Exists/DoesNotExist/In/NotIn 연산자로 좀 더 세밀하게 Pod를 선택하는 selector 방식 |
| **HorizontalPodAutoscaler (HPA)** | 리소스 사용량 지표를 보고 ReplicaSet/Deployment의 replicas 값을 자동으로 조정해주는 오브젝트 |

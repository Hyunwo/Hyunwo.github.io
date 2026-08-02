---
layout: post
title: "Deployment 배포 전략 4가지: Recreate, RollingUpdate, Blue-Green, Canary"
date: 2026-07-31
tags: [kubernetes, infra]
categories: [kubernetes]
---

오늘은 Deployment를 다루는 강의였다. 배포 전략 4가지 개요부터, Deployment가 실제로 어떻게 ReplicaSet을 만들어 동작하는지, Recreate와 RollingUpdate가 내부적으로 어떤 순서로 진행되는지까지 정리한다.

## Deployment는 왜 필요한가

Deployment는 이미 운영 중인 서비스를 업데이트해서 재배포해야 할 때 도움을 주는 Controller다. 본격적으로 Deployment 자체를 파헤치기 전에, 일반적으로 쓰이는 배포 방식 4가지가 쿠버네티스에서 어떻게 구현되는지 먼저 훑었다: **Recreate, RollingUpdate, Blue-Green, Canary**.

![4가지 배포 전략 비교]({{ site.baseurl }}/assets/images/k8s-deployment-strategies/deployment_strategies_compare.png)

---

## Recreate: 가장 단순하지만 다운타임이 있다

Deployment로 v1 Pod들이 떠 있는 상태에서 Recreate 방식으로 업그레이드하면, **기존 Pod를 전부 삭제한 다음** v2 Pod를 새로 만든다.

- 기존 Pod가 삭제되는 순간부터 새 Pod가 뜨기 전까지 **서비스 다운타임이 발생**한다
- 그 사이엔 자원 사용량도 0이 된다
- 일시적으로 서비스가 멈춰도 괜찮은 경우에만 쓸 수 있는 방식이다

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  replicas: 2
  strategy:
    type: Recreate
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
          image: my-web:v2
```

## RollingUpdate: 다운타임 없이 순차 교체

RollingUpdate는 업그레이드가 시작되면 **먼저 v2 Pod를 하나 만든다.** 이 순간 자원 사용량이 하나만큼 늘어난다.

이 상태부터는 v1과 v2가 동시에 서비스되기 때문에, 누군가는 v1에 접속하고 누군가는 v2에 접속하게 된다. 그다음 v1 Pod를 하나 지우고, 남은 v2를 하나 더 만들고, 마지막 남은 v1을 지우면서 전체가 v2로 넘어간다.

- 배포 도중에는 추가 자원이 필요하지만, **다운타임이 없다는 게 핵심 장점**이다

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
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
          image: my-web:v2
```

---

## Blue-Green: Deployment 기능이 아니라 label 전환으로 구현

Blue-Green은 Deployment 자체에 내장된 기능이 아니다. ReplicaSet처럼 **replicas를 관리하는 컨트롤러**를 활용해서 만드는 패턴이다.

동작 방식은 이렇다. Group A(v1)가 떠 있고 Service가 label로 Group A와 연결되어 있는 상태에서, **Group B(v2)를 완전히 새로 하나 더 만든다.** 이 순간 자원 사용량은 기존의 2배가 된다. 그리고 Service의 selector 라벨만 Group B로 바꿔주면, 기존 Group A와의 연결은 끊기고 즉시 Group B로 전환된다.

- 전환이 순간적으로 일어나기 때문에 **다운타임이 없다**
- v2에 문제가 생기면 라벨을 다시 v1으로 돌리기만 하면 되니 **롤백이 쉽다**
- 대신 **자원이 최대 2배** 필요하다는 게 단점이다. 문제가 없는 걸 확인하면 기존 버전(Group A)은 삭제하면 된다

---

## Canary: 일부 트래픽으로 먼저 검증

Canary는 카나리아(광부들이 위험 감지용으로 데려간 새)처럼, 위험을 먼저 검증하고 문제가 없으면 정식으로 배포하는 방식이다.

**방식 1: label을 공유해서 일부 트래픽만 흘려보내기**

v1 Pod들이 `type: app` 라벨로 Service에 연결되어 있는 상태에서, 테스트용 컨트롤러를 `replicas: 1`로 만들어 v2 Pod 하나를 같은 `type: app` 라벨로 연결한다. 그러면 Service로 들어오는 트래픽 중 일부가 이 v2 Pod로 흘러가면서 자연스럽게 신버전 테스트가 된다. 문제가 생기면 이 테스트용 컨트롤러의 `replicas`를 0으로 만들면 된다.

**방식 2: Ingress로 특정 대상만 타겟팅**

v1과 v2를 아예 별도 Service로 분리해두고, **Ingress Controller**가 URL 경로에 따라 어느 Service로 보낼지 정하는 방식이다. 예를 들어 글로벌 서비스에서 미국 리전만 신버전을 테스트하고 싶으면, 미국에서 들어오는 요청에 `EN` 같은 경로를 붙이도록 만들고 Ingress가 그 경로로 들어오는 요청만 v2 Service로 연결해주는 식이다. 이렇게 하면 특정 대상만 골라서 테스트할 수 있다.

두 방식 모두 **다운타임은 없고**, 자원 사용량은 테스트용으로 얼마나 많은 v2 Pod를 띄워두느냐, v1을 얼마나 유지하느냐에 따라 달라진다.

---

## Deployment는 직접 Pod를 안 만든다

Deployment를 만들 때 넣는 `selector`, `replicas`, `template` 값은 사실 Deployment 자신이 Pod를 만들어서 관리하기 위한 값이 아니다. **이 값들은 ReplicaSet을 만들 때 그대로 전달하기 위한 용도**다. 실제로 Pod를 만들고 관리하는 건 Deployment가 만들어낸 ReplicaSet이다.

정리하면 관계는 이렇다: **Deployment → ReplicaSet → Pod**. Service는 Pod의 라벨에 연결되기 때문에, 이 라벨만 맞으면 어느 ReplicaSet이 만든 Pod든 상관없이 Service를 통해 접근할 수 있다.

## Recreate가 내부적으로 동작하는 방식

template을 v2로 업데이트하면, Deployment는 이렇게 움직인다.

1. 기존 ReplicaSet의 `replicas`를 **0으로 변경**한다
2. ReplicaSet이 관리하던 Pod들이 전부 제거되고, Service도 연결 대상이 없어지면서 **이 시점에 다운타임이 발생**한다
3. v2 template을 가진 **새 ReplicaSet을 생성**한다
4. 새 Pod들이 v2로 만들어지고, 라벨이 일치하므로 Service가 자동으로 연결된다

여기서 중요한 부분: **기존 ReplicaSet은 삭제되지 않고 replicas 0인 상태로 남아있는다.** 다음에 또 업그레이드하면 이번엔 지금 만든 ReplicaSet이 0이 되고, 또 새로운 ReplicaSet이 생기는 식으로 계속 쌓인다.

이걸 관리하는 옵션이 `revisionHistoryLimit`이다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  replicas: 2
  revisionHistoryLimit: 1
  strategy:
    type: Recreate
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
          image: my-web:v2
```

`revisionHistoryLimit: 1`이면, 0으로 줄어든(비활성) ReplicaSet을 딱 하나만 남기고 그 이전 것들은 정리된다. 이 값을 아예 안 넣으면 기본값 10개까지 남는다. 그리고 이렇게 replicas 0으로 남아있는 과거 ReplicaSet은 **이전 버전으로 롤백하고 싶을 때** 다시 활용된다.

## RollingUpdate가 내부적으로 동작하는 방식

서비스가 v1으로 운영 중인 상태에서 template을 v2로 바꾸면:

1. 새 ReplicaSet을 만들고 `replicas`를 1로 설정 → v2 Pod 하나 생성. 라벨이 같으므로 Service에 바로 연결되고, 이제부터 v1/v2 트래픽이 분산된다
2. 기존(v1) ReplicaSet의 `replicas`를 1 줄인다 → Pod 하나 삭제
3. 새(v2) ReplicaSet의 `replicas`를 늘려서 하나 더 생성
4. 기존(v1) ReplicaSet의 `replicas`를 0으로 만들어 남은 Pod 전부 제거

Recreate와 마찬가지로 **기존 ReplicaSet은 삭제되지 않고 0으로 남는다.**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  replicas: 2
  minReadySeconds: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
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
          image: my-web:v2
```

`minReadySeconds`는 Pod가 뜨고 Ready 상태가 된 뒤, "정상적으로 사용 가능하다"고 최종 인정받기까지 기다리는 최소 시간이다. 이 값이 없으면 Pod가 추가되고 삭제되는 과정이 거의 순식간에 지나가버린다. 값을 주면 그만큼 텀을 두고 진행되기 때문에, 지금처럼 개념을 눈으로 확인하는 단계에서는 이 값을 넣어두면 과정을 관찰하기 편하다. (참고로 이 값은 readinessProbe 개념과 맞물려 동작하는데, 이건 추후 다른 글에서 다룰 예정이다.)

## pod-template-hash: 같은 라벨인데 왜 서로 안 섞일까

한 가지 의문이 들 수 있다. RollingUpdate 도중에는 v1 ReplicaSet과 v2 ReplicaSet이 **동시에** 존재하고, 둘 다 같은 라벨(`app: web`)로 Pod를 선택하도록 selector가 설정되어 있다. 그럼 v1 ReplicaSet이 v2 Pod까지 자기 것으로 착각해서 가져가버리는 문제가 생기지 않을까?

![Deployment-ReplicaSet-Pod 계층과 pod-template-hash]({{ site.baseurl }}/assets/images/k8s-deployment-strategies/deployment_hierarchy.png)

실제로는 그런 문제가 생기지 않는다. Deployment가 ReplicaSet을 만들 때, 사용자가 지정한 라벨(`app: web`) 말고 **눈에 안 보이는 라벨을 하나 더 몰래 붙여주기** 때문이다. 이게 `pod-template-hash`다.

동작을 예시로 보면 이렇다. Deployment가 template 내용(이미지 버전 등)을 기준으로 임의의 문자열 하나를 계산해서 ReplicaSet과 그 ReplicaSet이 만드는 Pod에 똑같이 붙여준다.

```
v1 ReplicaSet → 라벨: app=web, pod-template-hash=abc111
  └─ 이 ReplicaSet이 만든 Pod → 라벨: app=web, pod-template-hash=abc111

v2 ReplicaSet → 라벨: app=web, pod-template-hash=xyz222
  └─ 이 ReplicaSet이 만든 Pod → 라벨: app=web, pod-template-hash=xyz222
```

v1과 v2는 template 내용(이미지 버전)이 다르기 때문에 계산되는 문자열도 서로 다르게 나온다. 그래서 `app: web`이라는 라벨만 보면 두 ReplicaSet이 똑같은 걸 찾는 것처럼 보이지만, 실제로는 뒤에 숨어있는 `pod-template-hash` 값까지 같이 봐서 **v1 ReplicaSet은 hash가 abc111인 Pod만, v2 ReplicaSet은 hash가 xyz222인 Pod만** 정확히 골라서 관리한다. 서로의 Pod를 잘못 가져갈 일이 없는 구조인 셈이다.

즉 사용자 눈에 안 보이는 곳에서 Kubernetes가 알아서 충돌을 막아주는 안전장치라고 이해하면 된다.

---

## 용어 정리 (추가)

| 용어 | 설명 |
|---|---|
| **revisionHistoryLimit** | 업데이트 후 replicas 0으로 남는 과거 ReplicaSet을 몇 개까지 보관할지 지정. 기본값 10, 롤백에 사용됨 |
| **minReadySeconds** | Pod가 Ready 상태가 된 후 정상 사용 가능하다고 최종 인정하기까지 기다리는 최소 시간 |
| **pod-template-hash** | Deployment가 template 내용을 기반으로 자동 계산해서 ReplicaSet과 Pod에 붙이는 라벨. 같은 selector를 쓰는 여러 ReplicaSet이 서로 다른 버전의 Pod를 정확히 구분해서 관리하게 해줌 |

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Deployment** | Pod의 배포와 업데이트를 관리하는 Controller. 내부적으로 ReplicaSet을 만들어서 운용 |
| **Recreate** | 기존 Pod를 모두 삭제한 뒤 새 버전 Pod를 생성하는 배포 전략. 다운타임 발생 |
| **RollingUpdate** | 새 버전 Pod를 하나씩 만들고 기존 Pod를 하나씩 지우며 점진적으로 교체하는 전략. 다운타임 없음 |
| **maxSurge** | RollingUpdate 중 기존 개수보다 최대 몇 개까지 더 늘려서 만들 수 있는지 지정하는 값 |
| **maxUnavailable** | RollingUpdate 중 최대 몇 개까지 동시에 사용 불가 상태가 되어도 되는지 지정하는 값 |
| **Blue-Green** | 새 버전 그룹을 통째로 새로 띄운 뒤, Service의 selector를 한 번에 전환하는 배포 패턴. 다운타임 없지만 자원 2배 필요 |
| **Canary** | 일부 트래픽만 새 버전으로 흘려보내 검증한 뒤 점진적으로 확대하는 배포 패턴 |
| **Ingress Controller** | 유입되는 트래픽을 URL 경로 등의 규칙에 따라 다른 Service로 라우팅해주는 컴포넌트 |

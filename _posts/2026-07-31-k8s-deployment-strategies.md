---
layout: post
title: "Deployment 배포 전략 4가지: Recreate, RollingUpdate, Blue-Green, Canary"
date: 2026-07-31
tags: [kubernetes, infra]
categories: [kubernetes]
---

오늘은 Deployment를 다루는 강의였는데, 시간이 없어서 전반부(배포 전략 전체 개요)만 듣고 나머지(Recreate와 RollingUpdate 상세 실습)는 다음에 이어서 듣기로 했다. 일단 오늘 들은 부분까지 정리해둔다.

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

## 다음 시간에 이어서

오늘은 4가지 전략의 개념만 훑었고, 다음 시간에는 이 중 **Recreate와 RollingUpdate를 Deployment YAML로 직접 다루는 부분**을 더 자세히 볼 예정이다.

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

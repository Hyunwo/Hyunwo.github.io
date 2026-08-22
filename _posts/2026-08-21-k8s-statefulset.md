---
layout: post
title: "StatefulSet: Stateless와 다른 이유"
date: 2026-08-21
tags: [kubernetes, infra]
categories: [kubernetes]
---

오늘은 StatefulSet이었다. 지금까지 다룬 Deployment/ReplicaSet은 전부 "똑같은 Pod 여러 개"를 다루는 컨트롤러였는데, StatefulSet은 "서로 다른 역할을 가진 Pod들"을 다룬다는 점에서 접근 자체가 다르다.

## Stateless vs Stateful: 애초에 앱 성격이 다르다

StatefulSet을 이해하려면 먼저 애플리케이션의 두 성격부터 구분해야 한다.

![Stateless vs Stateful 앱]({{ site.baseurl }}/assets/images/k8s-statefulset/stateless_vs_stateful.png)

- **Stateless (예: 웹 서버)**: 여러 개를 띄워도 전부 동일한 역할을 한다. 하나가 죽고 새 걸로 대체돼도 이름이 뭐든 상관없다. 트래픽도 여러 Pod에 그냥 고르게 분산되면 된다
- **Stateful (예: 데이터베이스)**: 각 Pod가 서로 다른 역할을 갖는다. MongoDB Replica Set을 예로 들면 Primary(읽기·쓰기), Secondary(읽기 전용), Arbiter(장애 감시 후 Secondary를 Primary로 승격)로 역할이 나뉜다. Arbiter가 죽으면 "Arbiter 역할을 하는 무언가"가 다시 만들어져야 하고, 이름 자체가 그 Pod의 정체성이라 마음대로 바뀌면 안 된다. 트래픽도 역할에 맞게 의도적으로 연결해야 한다 (쓰기가 필요한 시스템은 Primary로, 조회만 하는 시스템은 Secondary로)

Deployment/ReplicaSet은 Stateless 앱을 위한 컨트롤러였고, 이 차이를 다루기 위해 나온 게 **StatefulSet**이다.

---

## ReplicaSet과 다른 점 1: Pod 이름과 생성 순서

![ReplicaSet vs StatefulSet: Pod 이름과 생성 순서]({{ site.baseurl }}/assets/images/k8s-statefulset/rs_vs_sts_naming.png)

- ReplicaSet은 Pod 이름 뒤에 랜덤 문자열이 붙고, 늘릴 때 여러 Pod가 **동시에** 생성된다
- StatefulSet은 `Pod-0`, `Pod-1`, `Pod-2`처럼 **순번**이 붙고, `Pod-0`이 완전히 뜬 다음에야 `Pod-1`이 생성되는 식으로 **하나씩 순차적으로** 만들어진다
- Pod 하나가 죽었을 때도 다르다. ReplicaSet은 새 이름으로 재생성되지만, StatefulSet은 **죽은 것과 같은 이름(`Pod-1`)으로 재생성**된다
- `replicas`를 0으로 줄일 때도, ReplicaSet은 전부 동시에 삭제되지만 StatefulSet은 **인덱스가 가장 높은 Pod부터 역순으로 하나씩** 삭제된다

이 모든 게 "이름 = 정체성"이라는 StatefulSet의 특성에서 나온다.

---

## ReplicaSet과 다른 점 2: PVC와 Headless Service

![StatefulSet: 각 Pod마다 전용 PVC + 예측 가능한 도메인]({{ site.baseurl }}/assets/images/k8s-statefulset/pvc_headless_sts.png)

ReplicaSet은 PVC를 미리 하나 만들어두고, template에서 그 PVC 이름을 지정해서 연결한다. 그래서 ReplicaSet의 모든 Pod는 **같은 PVC 하나를 공유**한다.

StatefulSet은 `volumeClaimTemplates`이라는 걸 쓰는데, Pod가 하나씩 만들어질 때마다 **전용 PVC가 자동으로 함께 생성**된다. `Pod-0`은 `PVC-0`과, `Pod-1`은 `PVC-1`과 연결되는 식이다. Pod가 죽었다가 같은 이름으로 재생성되면, 원래 연결되어 있던 PVC에 다시 붙는다.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: "db-headless"
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          image: my-db:latest
          volumeMounts:
            - name: data
              mountPath: /var/lib/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 5Gi
```

`replicas`를 줄여도 PVC는 삭제되지 않는다. 볼륨은 함부로 지우면 안 되는 데이터라, 정말 지우고 싶으면 사용자가 직접 지워야 한다.

> **최신 버전 추가 기능**: 이 "PVC는 절대 자동으로 안 지워진다"는 규칙이 기본값으로는 지금도 맞지만, **Kubernetes 1.27부터 베타, 1.32부터 정식 기능**으로 `persistentVolumeClaimRetentionPolicy`가 추가됐다. `whenDeleted`(StatefulSet 자체가 삭제될 때)와 `whenScaled`(replicas를 줄일 때) 각각에 대해 `Retain`(기본값) 또는 `Delete`를 선택할 수 있다. 필요하면 자동 삭제도 이제 가능하지만, 데이터 유실 위험이 있어서 신중하게 써야 한다.

마지막으로 `serviceName`에 지정한 이름과 매칭되는 **Headless Service**를 만들면, 각 Pod가 `pod-0.db-headless.default.svc.cluster.local` 같은 예측 가능한 도메인 이름을 갖게 된다. 그래서 내부 시스템이 "Primary 역할을 하는 `Pod-0`에만 연결하고 싶다"처럼 특정 Pod를 콕 집어 접근할 수 있다.

---

## 정리하면

| | ReplicaSet | StatefulSet |
|---|---|---|
| Pod 이름 | 랜덤 | 순번(`-0`, `-1`, ...) |
| 생성 방식 | 동시 생성 | 순차 생성 |
| 삭제 시 재생성 이름 | 새 이름 | 같은 이름 |
| Scale-in 순서 | 동시 삭제 | 높은 인덱스부터 순차 삭제 |
| Volume | 모든 Pod가 하나의 PVC 공유 | Pod마다 전용 PVC(volumeClaimTemplates) |
| 접근 방식 | 아무 Pod나 상관없음 | Headless Service로 특정 Pod 지정 가능 |

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Stateless 앱** | 여러 인스턴스가 모두 동일한 역할을 하는 애플리케이션 (예: 웹 서버) |
| **Stateful 앱** | 인스턴스마다 고유한 역할과 정체성을 갖는 애플리케이션 (예: 데이터베이스) |
| **StatefulSet** | Stateful 앱을 관리하기 위한 컨트롤러. Pod에 순번 이름을 부여하고 순차적으로 생성/삭제 |
| **volumeClaimTemplates** | StatefulSet에서 Pod가 생성될 때마다 전용 PVC를 자동으로 만들어주는 템플릿 |
| **persistentVolumeClaimRetentionPolicy** | StatefulSet 삭제/스케일 다운 시 PVC 자동 삭제 여부를 정하는 옵션 (1.32+, stable) |
| **serviceName** | StatefulSet이 사용할 Headless Service 이름을 지정하는 필드 |

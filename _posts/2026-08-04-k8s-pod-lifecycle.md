---
layout: post
title: "Pod 라이프사이클: Phase, Conditions, Container State"
date: 2026-08-04
tags: [kubernetes, infra]
categories: [kubernetes]
---

Pod 라이프사이클을 정리한다. 사람이 태어나서 유아기, 청소년기를 거쳐 생을 마감하듯, Pod도 생성부터 소멸까지 정해진 단계를 거친다. readiness probe, liveness probe, QoS 같은 개념들이 전부 이 단계와 맞물려 있어서, 처음에 제대로 짚어두면 이후 개념들이 훨씬 쉽게 이해된다.

## Pod Status는 3단계로 나뉜다

Pod를 생성하고 상태를 들여다보면 `Status` 안에 꽤 많은 정보가 들어있는데, 구조를 나누면 이렇다.

![Pod Status의 3계층 구조]({{ site.baseurl }}/assets/images/k8s-pod-lifecycle/pod_status_layers.png)

- **Phase**: Pod 전체를 대표하는 요약 상태
- **Conditions**: Pod가 각 단계를 통과했는지 True/False로 체크하는 항목들
- **Container State**: Pod 안의 컨테이너 하나하나의 개별 상태

## Phase: Pod의 대표 상태 (5가지)

`Pending`, `Running`, `Succeeded`, `Failed`, `Unknown` 이렇게 5가지가 있다.

## Conditions: 단계별 체크리스트 (4가지)

`PodScheduled`, `Initialized`, `ContainersReady`, `Ready` 이렇게 4가지가 있고, 각각 True/False 값을 가진다. False일 때는 왜 False인지 알아야 하니까 `Reason`이 같이 붙는다. 예를 들어 `Ready`가 False면 `ContainersNotReady`처럼 컨테이너 쪽이 아직 준비 안 됐다는 걸 알려주는 식이다.

## Container State: 컨테이너별 개별 상태 (3가지)

`Waiting`, `Running`, `Terminated` 이렇게 3가지가 있다. Conditions와 마찬가지로 세부 원인을 알려주는 `Reason`이 있는데, 예를 들어 컨테이너가 Waiting 상태이고 Reason이 `ContainerCreating`이면 아직 이미지를 받는 중이라는 뜻이다. 이때 `imageID` 값이 비어있는 걸 보면 아직 이미지가 다운로드되지 않았다는 것도 짐작할 수 있다.

---

## 실제로 어떻게 전이되는가

이제 이 상태들이 시간 순서대로 어떻게 바뀌는지 정리해본다.

![Pod Phase 전이 흐름]({{ site.baseurl }}/assets/images/k8s-pod-lifecycle/pod_phase_transition.png)

### 1. Pending: 생성 시작

Pod의 최초 상태는 `Pending`이다. 이 단계에서 일어나는 일들:

- **스케줄링**: 어느 Node에 올라갈지 정하는 단계. 직접 Node를 지정했으면 그 Node에, 아니면 쿠버네티스가 자원 상황을 보고 알아서 정한다. 완료되면 `PodScheduled`가 True가 된다
- **Init Container**: Node가 정해진 뒤, 본 컨테이너가 뜨기 전에 먼저 실행되는 초기화용 컨테이너다. 볼륨이나 보안 설정처럼 사전에 해둬야 하는 작업이 있을 때 쓴다. 이 작업이 성공하거나(또는 아예 설정하지 않았거나) 하면 `Initialized`가 True가 되고, 실패하면 False가 된다
- **이미지 다운로드**: 이 과정 동안 컨테이너는 `Waiting` 상태고 Reason은 `ContainerCreating`이다

> 순서가 중요한데, **Node가 먼저 정해져야(PodScheduled) 그 Node의 kubelet이 Pod를 넘겨받아 Init Container를 실행**할 수 있다. 그래서 정확한 순서는 `PodScheduled → Init Container 실행 → Initialized` 다.

### 2. Running: 컨테이너 기동

컨테이너가 실제로 기동되면 Pod와 컨테이너 모두 `Running`이 된다.

여기서 중요한 포인트 하나: 정상적으로 뜰 수도 있지만, 하나 또는 모든 컨테이너가 기동 중 문제가 생겨서 재시작될 수도 있다. 이때 컨테이너 상태는 다시 `Waiting`이 되고, Reason은 `CrashLoopBackOff`(반복적으로 크래시되고 재시작되는 상황)가 뜬다. Kubernetes는 이런 상황에서도 Pod 자체는 여전히 `Running`으로 간주하지만, 내부적으로 `ContainersReady`와 `Ready` Condition은 False가 된다.

**즉 Pod의 Phase가 Running이라고 해서 내부 컨테이너들이 다 정상인 건 아니다.** 그래서 Pod뿐 아니라 컨테이너 단위의 상태도 같이 모니터링해야 한다. 모든 컨테이너가 정상적으로 기동되면 그제서야 Conditions가 전부 True로 바뀐다. 계속 떠 있어야 하는 서비스라면 이 상태를 유지하는 게 목표다.

### 3. Succeeded / Failed: 작업형 Pod의 종료

Job이나 CronJob으로 만들어진 Pod는 작업을 마치면 더 이상 일을 하지 않는 상태가 되는데, 이때 Phase는 `Succeeded`나 `Failed` 둘 중 하나로 갈린다.

- 작업 중이던 컨테이너 중 하나라도 에러가 나면 → `Failed`
- 모든 컨테이너가 정상적으로 `Completed`되면 → `Succeeded`

성공이든 실패든 이 시점에는 `ContainersReady`와 `Ready`가 False로 바뀐다.

### 4. 그 외 케이스: 바로 Failed로, 혹은 Unknown

- `Pending` 상태에서 스케줄링이나 설정 자체가 실패하면 곧바로 `Failed`로 빠지기도 한다
- `Pending`이나 `Running` 중에 Node와 통신 장애가 생기면 `Unknown` 상태가 된다. 장애가 빨리 해결되면 원래 상태로 돌아가지만, 장애가 계속되면 결국 `Failed`로 넘어가기도 한다

---

## 왜 이걸 알아야 하는가

이 상태 구조를 알아두면, 앞으로 배울 개념들(readiness probe, liveness probe, QoS 등)이 정확히 어느 단계에서 어떤 값에 영향을 주는지, 그리고 그 개념 때문에 Pod의 다음 상태가 어떻게 바뀌는지 예측할 수 있게 된다. 지금 당장은 각 상태 이름을 외우는 것보다, "Phase는 요약이고 Conditions와 Container State가 실제 디테일을 갖고 있다"는 구조 자체를 기억해두는 게 더 중요할 것 같다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Phase** | Pod 전체를 대표하는 요약 상태. Pending/Running/Succeeded/Failed/Unknown 중 하나 |
| **Conditions** | Pod가 각 단계를 통과했는지 나타내는 체크리스트. PodScheduled/Initialized/ContainersReady/Ready |
| **Container State** | 개별 컨테이너의 상태. Waiting/Running/Terminated |
| **Init Container** | 본 컨테이너가 실행되기 전에 먼저 실행되는 초기화용 컨테이너 |
| **ContainerCreating** | 컨테이너가 Waiting 상태일 때, 이미지를 받는 중임을 나타내는 Reason |
| **CrashLoopBackOff** | 컨테이너가 반복적으로 크래시되고 재시작되는 상황을 나타내는 Reason |
| **Reason** | Condition이나 Container State가 False/특정 상태일 때, 그 구체적인 원인을 알려주는 필드 |

---
layout: post
title: "Pod QoS Classes: 자원이 부족할 때 누가 먼저 쫓겨나는가"
date: 2026-08-06
tags: [kubernetes, infra]
categories: [kubernetes]
---

오늘 강의는 QoS Classes였는데, 슬라이드 정보량이 많아서 처음엔 잘 안 들어왔다. 그림 하나에 Guaranteed/Burstable/BestEffort 세 가지가 한꺼번에 있고, OOM Score 계산까지 같이 나와서 헷갈렸다. 하나씩 쪼개서 다시 정리해본다.

## 왜 필요한 개념인가

Node에 자원이 딱 정해져 있고, 그 위에 Pod 3개가 자원을 골고루 나눠 쓰고 있다고 하자. 그런데 Pod 1이 갑자기 자원을 더 써야 하는 상황이 왔다. Node에는 더 줄 자원이 없다.

- Pod 1을 그냥 자원 부족으로 에러 내고 죽게 둬야 할까?
- 아니면 다른 Pod 하나를 희생시켜서 Pod 1에게 자원을 몰아줘야 할까?

쿠버네티스는 이 판단을 "아무 Pod나" 하지 않고, **앱의 중요도에 따라 3단계로 나눠서** 결정한다. 이게 **QoS Class(Quality of Service Class)**다.

---

## 3가지 등급과 축출 순서

![QoS 등급과 축출 순서]({{ site.baseurl }}/assets/images/k8s-qos/qos_eviction_order.png)

자원이 부족해지면 이 순서로 정리된다: **BestEffort → Burstable → Guaranteed**

- **BestEffort**: 제일 먼저 쫓겨난다. 애초에 자원을 보장받지 않은 Pod라 가장 희생시키기 쉽다
- **Burstable**: BestEffort가 이미 다 정리됐는데도 자원이 부족하면 다음 차례
- **Guaranteed**: 자기가 설정한 limit을 넘기기 전까지는 안전하다. 마지막까지 살아남는 등급

즉 정말 안정적으로 유지되어야 하는 서비스는 **Guaranteed**로 만들어야 한다는 뜻이다.

---

## 등급은 어떻게 정해지는가

중요한 포인트: QoS Class는 따로 설정하는 속성이 아니다. Pod를 만들 때 **각 컨테이너의 resources(requests/limits)를 어떻게 설정했는지에 따라 쿠버네티스가 자동으로 판정**한다.

| 등급 | 조건 |
|---|---|
| **Guaranteed** | Pod 안의 **모든** 컨테이너가 CPU·메모리 모두 requests와 limits를 갖고 있고, **requests = limits**로 정확히 같아야 함 |
| **BestEffort** | Pod 안의 **어떤** 컨테이너에도 requests/limits가 **전혀 설정되어 있지 않음** |
| **Burstable** | 위 두 조건에 해당하지 않는 나머지 전부. requests만 있고 limits가 없거나, requests \< limits이거나, 컨테이너 여러 개 중 하나만 제대로 설정되어 있거나 하는 경우 |

예시로 보면 감이 빨리 온다.

```yaml
# Guaranteed 예시: requests와 limits가 완전히 동일
resources:
  requests:
    memory: "1Gi"
    cpu: "1"
  limits:
    memory: "1Gi"
    cpu: "1"
```

```yaml
# Burstable 예시: requests와 limits가 다름 (또는 하나만 있음)
resources:
  requests:
    memory: "1Gi"
    cpu: "1"
  limits:
    memory: "2Gi"
    cpu: "2"
```

```yaml
# BestEffort 예시: resources 자체가 없음
resources: {}
```

Pod 안에 컨테이너가 여러 개라면 조건이 더 까다로워진다. 예를 들어 컨테이너 2개짜리 Pod에서 하나는 requests=limits로 완벽하게 맞춰놨어도, 나머지 하나에 아무 설정이 없다면 그 Pod 전체는 **Guaranteed가 아니라 Burstable**이 된다. Guaranteed는 "모든" 컨테이너가 조건을 만족해야 하기 때문이다.

---

## Burstable끼리는 누가 먼저 쫓겨날까: OOM Score

같은 Burstable 등급 Pod가 여러 개 있으면, 그중에서도 순서를 정해야 한다. 이때 기준이 **OOM Score(Out Of Memory Score)**다. 원리는 간단하다: **자신이 요청한 자원(request) 대비 실제로 얼마나 쓰고 있는지, 그 사용률이 높을수록 먼저 정리된다.**

![OOM Score 비교 예시]({{ site.baseurl }}/assets/images/k8s-qos/oom_score_example.png)

- Pod A: memory request 4Gi인데 실제로 3Gi를 쓰는 중 → 사용률 75%
- Pod B: memory request 8Gi인데 실제로 4Gi를 쓰는 중 → 사용률 50%

실제 사용량 자체는 Pod B가 더 많지만(4Gi \> 3Gi), **자기가 요청한 만큼 대비 얼마나 여유가 있느냐**가 기준이라 사용률이 더 높은 **Pod A가 먼저 쫓겨난다.** "내가 필요하다고 말한 양보다 훨씬 더 많이 쓰고 있는 Pod"부터 정리하는 셈이다.

---

## 정리하면

- 서비스의 중요도에 따라 resources 설정 방식을 다르게 가져가면 된다
- **꼭 안정적으로 떠 있어야 하는 서비스**(핵심 DB, 결제 시스템 등) → requests = limits로 맞춰서 **Guaranteed**
- **여유 있을 때 더 쓰고 부족하면 좀 덜 써도 되는 서비스** → requests \< limits로 **Burstable**
- **아무 때나 죽어도 크게 상관없는 배치성 작업** → resources 아예 안 정해서 **BestEffort**

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **QoS Class** | Pod의 resources 설정에 따라 쿠버네티스가 자동으로 부여하는 등급. Guaranteed/Burstable/BestEffort 중 하나 |
| **Guaranteed** | 모든 컨테이너에 requests=limits가 설정된 Pod. 자원 부족 시 가장 나중에 축출됨 |
| **Burstable** | requests/limits가 있지만 Guaranteed 조건은 만족하지 못하는 Pod. 두 번째로 축출됨 |
| **BestEffort** | 어떤 컨테이너에도 requests/limits가 없는 Pod. 가장 먼저 축출됨 |
| **OOM Score** | 같은 등급 안에서 축출 순서를 정하는 기준. request 대비 실제 사용률이 높을수록 점수가 높아짐(먼저 축출 대상) |

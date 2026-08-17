---
layout: post
title: "Kubernetes API 접근: 누가, 어떻게, 무엇을 할 수 있는가"
date: 2026-08-14
tags: [kubernetes, infra]
categories: [kubernetes]
---

이번 강의는 짧았는데 처음엔 이해가 잘 안 됐다. 다시 천천히 풀어서 정리해본다.

## 제일 먼저: 모든 건 API Server를 거친다

`kubectl get pod`를 치든, Dashboard를 쓰든, Pod 안에서 다른 자원을 조회하든 — 쿠버네티스와 관련된 모든 요청은 결국 Control Plane에 있는 **API Server** 하나를 거쳐 간다. API Server는 클러스터의 유일한 "정문"이다. 이 문을 통과하려면 세 단계를 거쳐야 한다.

![Kubernetes API Server, 누가 어떻게 접근하는가]({{ site.baseurl }}/assets/images/k8s-api-access/api_access_flow.png)

**① Authentication(인증)** → **② Authorization(인가)** → **③ Admission Control(승인 제어)**

이 순서를 이해하는 게 이번 강의의 핵심이다. 하나씩 풀어보자.

---

## ① Authentication: "누구세요?"

문을 두드린 사람이 누구인지 확인하는 단계다. 접근하는 주체는 크게 둘로 나뉜다.

### 사람이 접근하는 경우 (User Account)

- **외부에서 접근**: HTTPS + 인증서가 있어야 한다. 인증서 없이는 API Server 문턱도 못 넘는다
- **`kubectl proxy`를 열어둔 경우**: 관리자가 이 명령으로 로컬 프록시를 열어주면, 그 프록시를 통해서는 인증서 없이 HTTP로 접근할 수 있다. (프록시 자체가 이미 인증된 세션을 대신 열어주는 셈이다)
- **`kubeconfig`(컨텍스트) 관리**: 클러스터가 여러 개일 때, 매번 인증 정보를 새로 입력하지 않고 명령 하나로 원하는 클러스터로 전환할 수 있게 해주는 설정 파일이다

### Pod가 접근하는 경우 (Service Account)

Pod가 API Server에 마음대로 접근할 수 있다면 문제가 된다. Pod 하나만 만들면 누구나 그걸 통해 API Server를 건드릴 수 있게 되기 때문이다. 그래서 Pod 전용 계정인 **Service Account**가 있다. Service Account의 토큰은 Pod 안에 자동으로 주입돼서, Pod 내부 프로세스가 이 토큰으로 API Server에 요청을 보낸다.

> **여기서 최신 버전 기준으로 중요한 변화가 있다.** 예전에는 Service Account를 만들면 **평생 안 만료되는 토큰**이 Secret에 자동으로 저장됐다. 문제는 Pod가 해킹당하면 이 토큰을 훔쳐서 계속 악용할 수 있다는 거였다. **Kubernetes 1.24부터는 이 방식이 사라지고**, 기본 1시간짜리 임시 토큰이 자동으로 발급·갱신되며, **Pod가 삭제되면 토큰도 같이 무효화**된다. 지금은 이 방식이 기본이라, 옛날 자료에서 보던 "Service Account Secret에 토큰이 영구 저장된다"는 설명은 더 이상 기본 동작이 아니다.

### Dashboard도 결국 같은 문을 쓴다

Dashboard는 GUI일 뿐이고, 결국 API Server에 접근하는 방법 중 하나다. 설치 가이드를 그대로 따라서 프록시로 접근하고 로그인을 스킵하는 방식은 강의에서도 "보안상 좋지 않다"고 짚었는데, 이건 지금도 유효한 조언이다. 인증서를 가지고 정식으로 로그인하는 방식을 쓰는 게 맞다.

---

## ② Authorization: "이거 해도 되는 권한 있어요?"

신원이 확인됐다고 뭐든 할 수 있는 건 아니다. Namespace A에 있는 Pod가 API Server에 접근할 수 있다고 해서, Namespace B에 있는 Pod까지 마음대로 조회할 수 있으면 안 될 수도 있다. 이 사람(또는 Service Account)이 **어떤 자원에 어떤 동작(조회/생성/수정/삭제)까지 허용되는지**를 검사하는 단계가 Authorization이다. 이 강의에서는 개념만 짚었고, 실제로 권한을 어떻게 세밀하게 나누는지(RBAC)는 다음 강의에서 다룰 예정이다.

## ③ Admission Control: "이 요청, 우리 규칙에 맞아요?"

인증도 됐고 권한도 있어도, 마지막으로 클러스터 자체의 정책에 맞는지 한 번 더 체크한다. 예를 들어 관리자가 "PV는 1GB 이상 못 만든다"는 규칙을 걸어놨다면, 그보다 큰 PV를 만들려는 요청은 여기서 걸러진다. (이전에 정리한 LimitRange의 검증 시점도 결국 이 단계에 해당한다.)

> 이 부분도 최신 버전에서 발전했다. 예전엔 이런 규칙을 걸려면 별도의 Webhook 서버를 직접 만들어서 붙여야 했는데, 지금은 **ValidatingAdmissionPolicy**(Kubernetes 1.30부터 정식 기능)와 **MutatingAdmissionPolicy**(현재 최신 버전인 1.36부터 정식 기능)를 쓰면 별도 서버 없이 쿠버네티스 안에서 바로 규칙(CEL 표현식)을 정의할 수 있다. 이 강의에서는 Admission Control까지 자세히 다루진 않는다고 했으니, 나중에 실습에서 다시 볼 수 있을 것 같다.

---

## 정리하면

- 모든 요청은 **API Server**라는 하나의 문을 거친다
- 사람은 **User Account**(인증서·kubectl proxy·kubeconfig), Pod는 **Service Account**로 신원을 증명한다
- 신원이 확인되면(Authentication) → 권한이 있는지 보고(Authorization) → 클러스터 정책에 맞는지 마지막으로 검사한다(Admission Control)
- 이 세 단계를 다 통과해야 실제로 자원이 만들어지거나 조회된다

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **API Server** | 쿠버네티스의 모든 요청이 거쳐가는 유일한 진입점. Control Plane에 위치 |
| **User Account** | 사람이 API Server에 접근할 때 쓰는 계정 개념. 인증서 기반 |
| **Service Account** | Pod가 API Server에 접근할 때 쓰는 전용 계정. 토큰이 Pod에 자동 주입됨 |
| **kubectl proxy** | 인증된 세션을 대신 열어, 로컬에서 인증서 없이 API Server에 접근할 수 있게 해주는 명령 |
| **kubeconfig** | 여러 클러스터의 연결 정보를 관리하고 전환할 수 있게 해주는 설정 파일 |
| **Authentication** | "누구인지" 신원을 확인하는 단계 |
| **Authorization** | 확인된 신원이 "이 동작을 할 권한이 있는지" 검사하는 단계 |
| **Admission Control** | 인증·인가를 통과한 요청이 클러스터의 자체 정책에 맞는지 마지막으로 검사하는 단계 |
| **ValidatingAdmissionPolicy** | 별도 Webhook 서버 없이 CEL 표현식으로 검증 규칙을 정의하는 기능 (1.30+, stable) |
| **MutatingAdmissionPolicy** | 별도 Webhook 서버 없이 CEL 표현식으로 리소스를 변형하는 규칙을 정의하는 기능 (1.36+, stable) |

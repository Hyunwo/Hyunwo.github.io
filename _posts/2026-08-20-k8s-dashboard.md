---
layout: post
title: "Kubernetes Dashboard 보안 접근, 그리고 지금은 Headlamp"
date: 2026-08-20
tags: [kubernetes, infra]
categories: [kubernetes]
---

지금까지 배운 인증(Authentication)·인가(Authorization)를 종합하면 Dashboard 접근을 안전하게 만들 수 있다. 그런데 정리 과정에서 확인해보니, **Dashboard 프로젝트 자체에 큰 변화가 있었다.**

## 먼저 짚어야 할 것: Kubernetes Dashboard는 Archived됐다

![Kubernetes Dashboard, 2026년 1월 21일 공식 Archived]({{ site.baseurl }}/assets/images/k8s-dashboard/dashboard_archived.png)

**2026년 1월 21일, `kubernetes/dashboard` 저장소가 공식적으로 Archived(더 이상 유지보수 안 함) 처리됐다.** "유지보수할 사람이 없어서 프로젝트를 접는다"는 공지가 달렸고, 2026년 6월에는 쿠버네티스 공식 블로그가 **"Dashboard에서 Headlamp로 전환하라"**는 마이그레이션 가이드를 냈다.

- 이미 설치되어 있는 Dashboard가 갑자기 멈추는 건 아니지만, 보안 패치나 새 기능은 더 이상 안 나온다
- 신규로 구성한다면 **Headlamp**(Kubernetes SIG UI가 공식적으로 관리, CNCF Sandbox 프로젝트)를 쓰는 게 맞다

다행인 건, 이 글에서 정리한 핵심 — **"Pod가 ServiceAccount와 RBAC를 통해 어떻게 권한을 얻는가", "인증서와 토큰으로 어떻게 안전하게 접근하는가"** — 는 어떤 웹 UI를 쓰든 그대로 적용되는 원리다. Headlamp도 결국 API Server에 접근할 때 같은 RBAC 메커니즘을 그대로 쓴다. 그래서 아래 내용은 도구 이름만 Dashboard로 바뀌었을 뿐, 지금도 유효하다.

---

## AS-IS: 편하지만 위험한 접근

설치 가이드대로 Dashboard를 설치하면 `kube-system` Namespace에 Deployment로 Pod가 뜨고 Service와 연결된다. 이 상태로 NodePort를 통해 접근하면, **인증서도 로그인도 없이** "Skip" 버튼 하나로 바로 클러스터를 조회·조작할 수 있게 된다.

이게 가능한 이유는 Dashboard Pod에 연결된 ServiceAccount가 **RoleBinding + cluster-admin ClusterRole**을 통해 클러스터 전체 권한을 갖고 있기 때문이다. (기본적으로는 RoleBinding + 일반 Role만 있으면 자기 Namespace 안의 자원만 볼 수 있는데, 관리자가 ClusterRoleBinding으로 cluster-admin 권한을 따로 연결해줘야 클러스터 전체가 보이게 된다.)

## TO-BE: 인증서 + 토큰으로 이중 확인

![Dashboard 접근 방식: AS-IS vs TO-BE]({{ site.baseurl }}/assets/images/k8s-dashboard/dashboard_as_is_to_be.png)

보안을 강화하려면 이렇게 바꾼다.

1. kubectl이 갖고 있는 **Client key + Client 인증서**를 합쳐서 **p12 파일**로 만들고, 이걸 내 PC(브라우저)에 인증서로 등록한다
2. 이제 `https://<API Server>:6443`으로 접근하면, **인증서 없이는 애초에 접속 자체가 안 된다**
3. 접속이 되어도 로그인 화면이 뜨는데, 여기서 **ServiceAccount의 토큰 값**을 직접 입력해야 로그인이 완료된다

이렇게 하면 두 가지 장벽이 생긴다. **① 인증서가 없으면 API Server 문턱도 못 넘고, ② 문턱을 넘어도 토큰을 모르면 로그인이 안 된다.** IP와 포트만 아는 것으로는 아무것도 할 수 없다.

> 참고로 여기서 쓰는 토큰도, 지난 8/17·8/18 글에서 정리한 것처럼 지금(Kubernetes 1.24+)은 Secret에 자동으로 안 붙는다. `kubectl create token <ServiceAccount 이름>`으로 직접 발급받아서 로그인에 써야 한다.

---

## 정리하면

- Dashboard 자체는 프로젝트가 종료됐고, 지금은 **Headlamp**가 공식 후속
- 그래도 여기서 정리한 **RBAC + 인증서/토큰 기반 접근 원리**는 Headlamp에도, 앞으로 쓸 다른 어떤 관리 도구에도 그대로 적용된다
- 핵심 교훈: **"편한 접근 방법(Skip 로그인, NodePort)"과 "안전한 접근 방법(인증서+토큰)" 사이의 트레이드오프**는 Dashboard뿐 아니라 클러스터 운영 전반에서 계속 마주치게 될 주제다

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Kubernetes Dashboard** | 쿠버네티스 공식 웹 UI였으나 2026년 1월 Archived, 더 이상 유지보수 안 됨 |
| **Headlamp** | Dashboard의 공식 후속 프로젝트. Kubernetes SIG UI가 관리하는 CNCF Sandbox 프로젝트 |
| **client p12** | Client key + Client 인증서를 합쳐 만든 파일. 브라우저/PC에 등록해서 HTTPS 인증에 사용 |
| **cluster-admin** | Kubernetes에 기본으로 존재하는, 클러스터 전체에 대한 모든 권한을 가진 ClusterRole |

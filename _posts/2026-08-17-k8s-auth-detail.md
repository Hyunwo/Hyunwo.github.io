---
layout: post
title: "Authentication 상세: X.509 인증서, kubeconfig, ServiceAccount"
date: 2026-08-17
tags: [kubernetes, infra]
categories: [kubernetes]
---

지난 글(8/14)에서 Authentication을 개념만 짚었다면, 오늘은 실제로 API Server에 접근할 때 쓰는 3가지 방법 — **X.509 인증서, kubectl(kubeconfig), ServiceAccount**를 좀 더 실제 동작 단위로 파고들었다.

## 인증서는 어떻게 만들어지는가

먼저 인증서 발급 과정 자체를 알아야 kubeconfig 구조가 이해된다. 동사무소에서 신분증을 만드는 과정으로 생각하면 쉽다.

![인증서는 어떻게 만들어지는가]({{ site.baseurl }}/assets/images/k8s-auth-detail/cert_issuance.png)

- **CA(발급기관)**: 자기 개인키(CA key)로 요청서(CA CSR)를 만들고, 그걸로 자기 자신의 인증서(CA.crt)를 만든다. 이게 신뢰의 뿌리가 된다
- **Client(사용자)**: 자기 개인키(Client key)로 요청서(Client CSR)를 만든다. 이 요청서를 CA에게 가져가면, CA가 자기 key와 crt로 서명해서 Client.crt(유효한 신분증)를 만들어준다

이렇게 만들어진 **CA.crt, Client.crt, Client.key** 세 가지가 **kubeconfig 파일 안에 저장**되어 있다. API Server에 6443 포트로 HTTPS 접근할 때 이 파일을 근거로 신원이 확인되는 것이다.

## kubeconfig: 여러 클러스터를 갈아타는 방법

kubeadm으로 클러스터를 설치하면, 관리자용 kubeconfig 파일이 kubectl이 쓰는 위치로 복사되면서 자동으로 인증이 연결된다. 이 덕분에 별도 설정 없이 `kubectl get pod` 같은 명령이 바로 동작하는 것이다.

클러스터가 여러 개라면 kubeconfig 안에서 이렇게 구조가 나뉜다.

![kubeconfig 구조]({{ site.baseurl }}/assets/images/k8s-auth-detail/kubeconfig_structure.png)

- **clusters**: 클러스터 이름, 접속 주소, CA 인증서 정보
- **users**: 사용자 이름, 그 사용자의 인증서·키
- **contexts**: 위 둘을 묶어서 "이 클러스터에는 이 유저로 접속한다"는 조합에 이름을 붙인 것

```bash
# 현재 사용할 context를 지정
kubectl config use-context context-A

# 이후의 모든 kubectl 명령은 context-A(cluster-A + admin-A)로 실행됨
kubectl get node
```

**kubectl proxy**도 짚고 넘어갈 부분이다. `--accept-hosts` 옵션과 함께 기본 8001번 포트로 프록시를 열어두면, 이 프록시가 이미 인증서를 들고 있는 상태라 **외부에서 그 프록시로 접근할 때는 인증서 없이 HTTP로 접근**할 수 있다. 편리하지만, 그만큼 이 프록시 접근 자체를 잘 통제해야 한다는 뜻이기도 하다.

---

## ServiceAccount: Pod가 API Server에 접근하는 방법

여기서부터는 **최신 버전 기준으로 강의 내용을 정정해야 하는 부분**이다.

강의에서는 이렇게 설명한다: Namespace를 만들면 `default`라는 ServiceAccount가 자동으로 생기고, 여기에 **Secret이 하나 자동으로 붙어서** 그 안에 `ca.crt`와 **토큰 값**이 들어있다. Pod를 만들면 이 ServiceAccount가 연결되고, Pod는 이 토큰으로 API Server에 접근한다. 그리고 이 토큰 값만 알면 사용자도 그대로 가져다 쓸 수 있다고 설명한다.

이건 **Kubernetes 1.23 이전까지의 동작**이다.

![ServiceAccount 토큰, 강의와 지금은 이렇게 다르다]({{ site.baseurl }}/assets/images/k8s-auth-detail/sa_token_comparison.png)

**Kubernetes 1.24부터는 default ServiceAccount에 Secret이 자동으로 붙지 않는다.** 대신:

- Pod가 뜰 때마다 **1시간짜리 임시 토큰**이 자동으로 발급돼서 Pod 안에 주입된다 (projected volume 방식)
- 이 토큰은 **Pod가 삭제되면 같이 무효화**된다
- 그래서 강의에서처럼 "Secret을 조회해서 토큰 값을 복사해 쓰는" 실습을 그대로 따라 하면, Secret 자체가 안 보여서 당황할 수 있다

지금 버전에서 실습을 그대로 재현하려면, 토큰을 직접 발급받아야 한다.

```bash
# default ServiceAccount의 토큰을 직접 발급 (기본 1시간 유효)
kubectl create token default
```

왜 이렇게 바뀌었는지도 이해하면 좋다. 예전 방식은 토큰이 영구적이라, Pod 하나가 뚫리면 그 안의 토큰을 훔쳐서 **Pod가 사라진 뒤에도 계속** API Server에 접근할 수 있는 보안 문제가 있었다. 지금 방식은 토큰 수명이 Pod의 수명과 묶여 있어서, 이 위험이 크게 줄어든다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **CA (Certificate Authority)** | 인증서를 발급해주는 기관. 자신의 CA key/CSR로 CA.crt(루트 인증서)를 만듦 |
| **CSR (Certificate Signing Request)** | 인증서를 만들어달라고 요청하는 파일. 개인키로 생성 |
| **kubeconfig** | 클러스터 접속 정보(clusters), 사용자 인증 정보(users), 그 조합(contexts)을 담은 설정 파일 |
| **context** | kubeconfig 안에서 "어느 클러스터에 어느 유저로 접속할지"를 묶어 이름 붙인 것 |
| **kubectl proxy** | 로컬에 인증된 프록시를 열어, 그 프록시로는 인증서 없이 HTTP로 접근 가능하게 하는 명령 |
| **default ServiceAccount** | Namespace 생성 시 자동으로 만들어지는 기본 ServiceAccount |
| **kubectl create token** | ServiceAccount의 임시 토큰을 직접 발급하는 명령 (Kubernetes 1.24+ 환경에서 사용) |

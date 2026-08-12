---
layout: post
title: "Service 심화: DNS, Headless Service, Endpoint, ExternalName"
date: 2026-08-10
tags: [kubernetes, infra]
categories: [kubernetes]
---

초급편에서 배운 Service(ClusterIP, NodePort, LoadBalancer)는 전부 "사용자가 Pod에 접근하는" 관점이었다. 오늘은 반대로 **Pod가 다른 Pod나 외부 서비스에 연결하는** 관점을 다뤘다.

## 복습: 사용자가 Pod에 접근하는 3가지 방법

| 타입 | 접근 범위 | 동작 |
|---|---|---|
| **ClusterIP** | 클러스터 내부(Node)에서만 | Service 전용 IP 대역에서 고정 IP 할당 |
| **NodePort** | 내부망 전체 | 모든 Node에 30000~32767 포트를 열어서 연결 |
| **LoadBalancer** | 외부 인터넷 | 클라우드(GCP/AWS/Azure)의 로드밸런서를 자동 프로비저닝해서 외부 IP 부여 |

이 세 가지는 전부 "사람이 서비스 IP를 보고 접근하는" 상황을 위한 거였다.

## 오늘의 문제: Pod가 다른 Pod를 어떻게 찾을까

Pod A가 Pod B에 접근해야 하는 상황을 생각해보자. IP를 코드에 박아두면 안 된다. 이유는 두 가지다.

- Pod와 Service의 IP는 생성 시점에 동적으로 할당돼서, Pod A 입장에서 미리 알 방법이 없다
- Pod B가 죽고 재생성되면 IP가 바뀌어버려서, 설령 한 번 알아냈어도 계속 쓸 수 없다

이 문제를 해결하는 게 **DNS**다. 그리고 여기서 파생되는 두 가지 상황(개별 Pod를 직접 찾아야 할 때, 외부 주소가 바뀔 수 있을 때)을 위해 **Headless Service**와 **ExternalName**이 존재한다.

---

## Kubernetes DNS와 FQDN

쿠버네티스 클러스터 안에는 내부 DNS 서버(CoreDNS)가 별도로 떠 있다. Pod나 Service가 생성되면 여기에 도메인 이름과 IP가 자동으로 등록된다.

![Kubernetes DNS 이름의 구조]({{ site.baseurl }}/assets/images/k8s-service-advanced/fqdn_structure.png)

이런 규칙으로 이름이 붙는 걸 **FQDN(Fully Qualified Domain Name)**이라고 한다. 같은 Namespace 안에서는 Service 이름 앞부분만 써도 되지만(`service1`), 다른 Namespace에 있는 Service를 부르려면 전체를 다 써야 한다(`service1.other-ns`). Pod 쪽 DNS 이름은 IP가 그대로 들어가는 형태라 실제로는 잘 안 쓰인다.

이 규칙 덕분에, Pod 코드에는 IP 대신 **Service 이름만 미리 심어두면** 된다. 이름은 어차피 사람이 직접 정하는 거니까, 미리 예상해서 넣어둘 수 있다. 여기까지는 그냥 ClusterIP Service만 있어도 충분하다.

---

## Headless Service: 특정 Pod를 콕 집어야 할 때

문제는 "아무 Pod나 연결되면 되는 게 아니라, **이 Pod랑만** 통신해야 한다"는 상황이다. 이럴 때 일반 ClusterIP Service로는 안 되고 **Headless Service**가 필요하다.

![ClusterIP Service vs Headless Service]({{ site.baseurl }}/assets/images/k8s-service-advanced/headless_service.png)

만드는 방법은 간단하다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: headless1
spec:
  clusterIP: None
  selector:
    app: myapp
  ports:
    - port: 80
```

`clusterIP: None`이면 Service의 IP 자체가 만들어지지 않는다. 이 상태에서 이 Service의 도메인 이름을 조회하면, Service IP 하나가 아니라 **연결된 모든 Pod의 IP**가 반환된다.

개별 Pod를 이름으로 직접 부르고 싶다면 Pod 쪽에도 설정이 필요하다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod4
spec:
  hostname: pod4
  subdomain: headless1
  containers:
    - name: app
      image: my-app
```

`subdomain`에 Headless Service 이름을 넣으면, 이 Pod는 `pod4.headless1.default.svc.cluster.local`이라는 자기만의 도메인 이름을 갖게 되고, 짧게는 `pod4.headless1`로도 접근할 수 있다.

---

## Endpoint: Service와 Pod를 실제로 이어주는 오브젝트

Service와 Pod는 라벨-셀렉터로 연결한다고 배웠는데, 이건 어디까지나 **사용자가 설정하는 연결 조건**일 뿐이다. 쿠버네티스는 이 조건이 매칭되면 실제 연결 정보(Pod IP, 포트 목록)를 별도의 오브젝트로 관리하는데, 이 규칙을 알면 라벨-셀렉터 없이도 수동으로 연결 대상을 지정할 수 있다.

**여기서 최신 버전 기준으로 중요한 변화가 하나 있다.**

![Endpoints는 지금 EndpointSlice로 만든다]({{ site.baseurl }}/assets/images/k8s-service-advanced/endpoints_deprecated.png)

예전에는 `Endpoints`(v1) 오브젝트를 직접 만들어서 Service의 연결 대상을 수동 지정했는데, **Kubernetes 1.33부터 이 `Endpoints` API가 공식적으로 Deprecated**됐다. `kube-proxy`나 `CoreDNS`도 이미 내부적으로는 `EndpointSlice`를 쓰고 있고, `Endpoints`는 하위 호환을 위해서만 남아있는 상태다. 그래서 지금(1.36 기준)은 수동으로 연결 대상을 지정할 때도 `EndpointSlice`로 만드는 게 맞다.

```yaml
# Service는 selector 없이 만든다
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  ports:
    - port: 5432
---
# 연결 대상은 EndpointSlice로 직접 지정
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: external-db-1
  labels:
    kubernetes.io/service-name: external-db
addressType: IPv4
ports:
  - port: 5432
endpoints:
  - addresses:
      - "192.168.0.100"
```

`labels`의 `kubernetes.io/service-name`으로 어느 Service와 연결되는지 지정한다. 이렇게 하면 클러스터 밖의 DB 서버 같은 것도 Service 하나로 감싸서, Pod 입장에서는 평범한 내부 Service처럼 접근할 수 있다.

---

## ExternalName: 외부 도메인을 가리키는 Service

Pod가 외부 사이트(Google, GitHub 등)에 접근하는데, 나중에 그 주소가 바뀔 수 있다면? Pod 코드를 고치고 재배포하는 대신 **Service의 주소만 바꾸는 방법**이 있다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-api
spec:
  type: ExternalName
  externalName: github.com
```

Pod는 `external-api`라는 Service 이름만 보고 요청을 보낸다. DNS가 이 요청을 `github.com`으로 연결해주는 것이다(CNAME 방식). 나중에 연동 대상이 바뀌면 `externalName` 값만 바꾸면 되고, Pod는 손댈 필요가 없다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **FQDN** | Fully Qualified Domain Name. 쿠버네티스가 Service/Pod에 자동으로 붙이는 전체 도메인 이름 규칙 |
| **CoreDNS** | 클러스터 내부에서 Service/Pod의 이름을 IP로 변환해주는 DNS 서버 |
| **Headless Service** | `clusterIP: None`으로 만들어, Service IP 없이 연결된 Pod들의 IP를 직접 반환하는 Service |
| **hostname / subdomain** | Pod가 Headless Service를 통해 자신만의 도메인 이름을 갖도록 설정하는 필드 |
| **Endpoints** | Service와 Pod의 실제 연결 정보를 담던 오브젝트. Kubernetes 1.33부터 Deprecated |
| **EndpointSlice** | Endpoints를 대체하는 현재의 표준 오브젝트. Service의 연결 대상을 수동으로 지정할 때도 이걸 사용 |
| **ExternalName** | Service를 외부 도메인 이름과 연결(CNAME)해주는 Service 타입. Pod 수정 없이 연동 대상 변경 가능 |

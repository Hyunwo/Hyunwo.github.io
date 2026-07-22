---
layout: post
title: "쿠버네티스 클러스터, 네임스페이스, 컨트롤러 개념 정리"
date: 2026-07-22
tags: [kubernetes, infra]
---

오늘 강의는 쿠버네티스의 뼈대가 되는 개념들을 쭉 훑는 내용이었다. 클러스터가 뭔지부터 시작해서 네임스페이스, Pod, 볼륨, 컨트롤러까지 한 번에 나와서 정리하지 않으면 금방 헷갈릴 것 같았다.

## 클러스터: Master 한 대, Node 여러 대

쿠버네티스 **클러스터**는 서버 한 대를 **Master**로 두고, 나머지 서버들을 **Node**로 두는 구조다. Master 하나에 Node 여러 개가 붙는다.

![Cluster 구조]({{ site.baseurl }}/assets/images/k8s-cluster-basics/cluster_architecture.png)

역할을 나눠보면 이렇다.

- **Master**: 클러스터 전체를 컨트롤한다. "누구를 어디에 배치할지, 뭐가 죽었는지" 같은 걸 관리
- **Node**: 실제로 컨테이너가 돌아가는 곳. CPU, 메모리 같은 자원을 제공

---

## 네임스페이스: 이름이 겹치지 않게 나누는 공간

클러스터 안에는 **Namespace**라는 게 있는데, 오브젝트들을 서로 다른 공간으로 나눠준다.

![Namespace 격리]({{ site.baseurl }}/assets/images/k8s-cluster-basics/namespace_isolation.png)

한 Namespace 안에는 쿠버네티스 최소 배포 단위인 **Pod**들이 있다. Pod는 재생성될 때마다 IP가 바뀌기 때문에, 고정된 주소로 접근할 수 있도록 **Service**가 Pod 앞에 고정 IP를 하나 붙여준다.

여기서 헷갈렸던 부분이 있는데, 이 IP가 외부에서 바로 쓸 수 있는 IP는 아니다. Service 타입에 따라 역할이 달라진다.

| Service 타입 | 설명 |
|---|---|
| **ClusterIP** (기본값) | 클러스터 내부에서만 접근 가능한 고정 IP |
| **NodePort** | Node의 특정 포트를 열어서 `Node IP:포트`로 외부 접근 허용 |
| **LoadBalancer** | 클라우드 로드밸런서(AWS ALB/NLB 등)를 자동으로 만들어서 외부용 IP 발급 |
| **ExternalName** | 외부 도메인 이름과 연결해주는 특수 타입 |

정리하면, 기본값인 ClusterIP는 오히려 내부용이고, 외부에서 접근하려면 NodePort나 LoadBalancer로 만들어야 한다.

Namespace 간 통신도 처음엔 완전히 막혀있는 줄 알았는데, 그것도 아니었다. 같은 Namespace 안에서는 서비스 이름만으로 접근되지만, 다른 Namespace의 Pod한테 가려면 전체 도메인 이름(`서비스명.네임스페이스.svc.cluster.local`)을 써야 한다. 즉 Namespace는 네트워크를 차단하는 게 아니라, 이름이 겹치지 않게 범위를 나눠주는 역할에 더 가깝다. 진짜로 통신 자체를 막고 싶으면 **NetworkPolicy**를 따로 설정해야 한다.

### 자원 제한: ResourceQuota, LimitRange

한 Namespace가 자원을 너무 많이 쓰지 않도록 **ResourceQuota**와 **LimitRange**로 제한을 걸 수 있다. Pod 개수를 제한하거나, CPU·메모리 사용량을 제한하는 식이다.

### 설정값 주입: ConfigMap, Secret

Pod를 만들 때 컨테이너에 환경 변수를 넣거나 파일을 마운트해줘야 할 때가 있는데, 이걸 **ConfigMap**이나 **Secret**으로 처리한다. 둘의 차이는 민감한 정보냐 아니냐 정도다.

---

## Pod와 Volume: 재생성되면 데이터가 날아간다

Pod 안에는 컨테이너가 여러 개 들어갈 수 있고, 컨테이너 하나가 앱 하나를 담당한다. 그런데 Pod에 문제가 생겨서 재생성되면, 그 안에 있던 데이터도 같이 사라진다.

![Pod와 Volume]({{ site.baseurl }}/assets/images/k8s-cluster-basics/pod_volume.png)

이걸 해결하는 방법이 **Volume**이다. Pod에 Volume을 연결해두면 데이터가 Volume 쪽에 따로 저장되기 때문에, Pod가 재생성돼도 데이터는 그대로 남는다.

---

## 컨트롤러: Pod를 관리하는 다섯 가지 방식

**컨트롤러**는 Pod를 관리해주는 역할인데, 용도별로 종류가 꽤 나뉜다.

| 컨트롤러 | 역할 |
|---|---|
| **ReplicationController / ReplicaSet** | 가장 기본. Pod가 죽으면 다시 살리고, 개수를 늘리거나 줄임 |
| **Deployment** | Pod를 새 버전으로 업그레이드. 문제가 생기면 롤백도 쉽게 해줌 |
| **DaemonSet** | 노드 하나당 Pod 하나씩 유지 |
| **Job** | 특정 작업만 하고 끝내야 할 때 사용 |
| **CronJob** | Job을 주기적으로 실행 |

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Cluster** | Master 한 대와 Node 여러 대로 구성된 쿠버네티스 시스템 전체 |
| **Master** | 클러스터 전체를 컨트롤하는 서버 |
| **Node** | 컨테이너가 실행될 자원을 제공하는 서버 |
| **Namespace** | 오브젝트들의 이름 범위를 나눠주는 객체. 기본적으로 네트워크 자체를 막지는 않음 |
| **Pod** | 쿠버네티스 최소 배포 단위, 1개 이상의 컨테이너로 구성 |
| **Service** | Pod에 고정 IP를 붙여주는 오브젝트. 기본값(ClusterIP)은 내부용 |
| **NetworkPolicy** | Namespace 간, Pod 간 네트워크 통신을 실제로 제한할 때 쓰는 오브젝트 |
| **Volume** | Pod가 재생성돼도 데이터가 유지되도록 별도로 저장하는 공간 |
| **ResourceQuota** | Namespace 전체가 쓸 수 있는 자원(Pod 개수, CPU, 메모리)을 제한 |
| **LimitRange** | Namespace 안 개별 Pod·컨테이너 단위 자원 사용 범위를 제한 |
| **ConfigMap** | 민감하지 않은 설정값을 컨테이너에 주입할 때 사용 |
| **Secret** | 민감한 설정값(비밀번호 등)을 컨테이너에 주입할 때 사용 |
| **ReplicationController / ReplicaSet** | Pod 개수를 유지하고 죽은 Pod를 다시 살리는 기본 컨트롤러 |
| **Deployment** | Pod 버전 업그레이드와 롤백을 관리하는 컨트롤러 |
| **DaemonSet** | 노드마다 Pod 하나씩 유지시키는 컨트롤러 |
| **Job** | 특정 작업을 1회 수행하고 종료하는 컨트롤러 |
| **CronJob** | Job을 주기적으로 실행시키는 컨트롤러 |

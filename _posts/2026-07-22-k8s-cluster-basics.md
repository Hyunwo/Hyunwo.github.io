---
layout: post
title: "쿠버네티스 클러스터, 네임스페이스, 컨트롤러 개념 정리"
date: 2026-07-22
tags: [kubernetes, infra]
---

## Cluster: Master와 Node

쿠버네티스 **클러스터**는 서버 한 대를 **Master**로, 나머지 서버들을 **Node**로 두고, 하나의 Master에 여러 Node가 연결되는 구조를 말한다.

![Cluster 구조]({{ site.baseurl }}/assets/images/k8s-cluster-basics/cluster_architecture.png)

- **Master**: 쿠버네티스 전반적인 기능을 컨트롤하는 역할
- **Node**: 실제로 컨테이너가 돌아갈 자원(CPU, 메모리 등)을 제공하는 역할

---

## Namespace: 오브젝트를 독립된 공간으로 분리

클러스터 안에는 **Namespace**라는 객체가 있는데, 이게 쿠버네티스 오브젝트들을 독립된 공간으로 분리해준다.

![Namespace 격리]({{ site.baseurl }}/assets/images/k8s-cluster-basics/namespace_isolation.png)

- 한 Namespace 안에는 쿠버네티스의 최소 배포 단위인 **Pod**들이 있고, 외부에서 연결 가능하도록 IP를 할당해주는 **Service**가 있어서 Pod에 접근할 수 있다
- **서로 다른 Namespace에 있는 Pod끼리는 연결이 불가능**하다 → 이게 Namespace가 "독립된 공간"을 만들어준다는 의미

### 자원 제한: ResourceQuota / LimitRange

Namespace에는 **ResourceQuota**와 **LimitRange**를 걸어서 그 Namespace가 사용할 수 있는 자원의 양을 제한할 수 있다.

- Pod 개수 제한
- CPU, 메모리 사용량 제한

### 설정 주입: ConfigMap / Secret

Pod를 생성할 때 컨테이너 안에 환경 변수 값을 넣거나 파일을 마운트해줄 수 있는데, 이 세팅을 **ConfigMap**이나 **Secret**을 통해서 할 수 있다.

---

## Pod와 Volume: 데이터 유실 문제

Pod 안에는 여러 컨테이너가 있을 수 있고, 컨테이너 하나당 앱 하나가 동작하기 때문에 결국 한 Pod에서 여러 앱이 돌아갈 수 있다.

문제는, Pod에 이상이 생겨 **재생성**되면 그 안에 있던 데이터가 함께 사라진다는 것이다.

![Pod와 Volume]({{ site.baseurl }}/assets/images/k8s-cluster-basics/pod_volume.png)

이 문제를 해결하기 위해 **Volume**을 만들어서 Pod에 연결하면, 데이터를 Volume에 별도로 저장할 수 있다. 그러면 Pod가 재생성되어도 데이터는 Volume에 그대로 남아있기 때문에 데이터 유실 문제를 해결할 수 있다.

---

## 컨트롤러: Pod를 관리하는 역할

**컨트롤러**는 Pod들을 관리해주는 역할을 하며, 용도에 따라 여러 종류가 있다.

| 컨트롤러 | 역할 |
|---|---|
| **ReplicationController / ReplicaSet** | 가장 기본적인 컨트롤러. Pod가 죽으면 감지해서 다시 살리고, Pod 개수를 늘리거나 줄일 수 있음 |
| **Deployment** | 배포 후 Pod들을 새 버전으로 업그레이드해줌. 업그레이드 중 문제가 생기면 롤백을 쉽게 할 수 있도록 도와줌 |
| **DaemonSet** | 노드 하나당 Pod가 하나씩만 유지되도록 함 |
| **Job** | 특정 작업만 수행하고 종료해야 하는 일을 처리할 때 사용 |
| **CronJob** | Job을 주기적으로 실행해야 할 때 사용 |

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Cluster** | 하나의 Master와 여러 Node로 구성된 쿠버네티스 시스템 전체 |
| **Master** | 쿠버네티스 전반적인 기능을 컨트롤하는 서버 |
| **Node** | 컨테이너가 실행될 자원을 제공하는 서버 |
| **Namespace** | 클러스터 안에서 오브젝트들을 독립된 공간으로 분리해주는 객체 |
| **Pod** | 쿠버네티스의 최소 배포 단위, 1개 이상의 컨테이너를 포함 |
| **Service** | Pod에 외부에서 연결 가능하도록 IP를 할당해주는 오브젝트 |
| **Volume** | Pod가 재생성되어도 데이터가 유지되도록 별도로 저장하는 공간 |
| **ResourceQuota** | Namespace가 사용할 수 있는 전체 자원(Pod 개수, CPU, 메모리 등)을 제한하는 오브젝트 |
| **LimitRange** | Namespace 내 개별 Pod/컨테이너 단위의 자원 사용 범위를 제한하는 오브젝트 |
| **ConfigMap** | 환경 변수나 설정 파일을 컨테이너에 주입할 때 사용하는 오브젝트 (민감하지 않은 정보) |
| **Secret** | 환경 변수나 설정 파일을 컨테이너에 주입할 때 사용하는 오브젝트 (민감한 정보, 예: 비밀번호) |
| **ReplicationController / ReplicaSet** | Pod의 개수를 유지하고, 죽은 Pod를 감지해 다시 살리는 기본 컨트롤러 |
| **Deployment** | Pod의 버전 업그레이드와 롤백을 관리하는 컨트롤러 |
| **DaemonSet** | 각 노드마다 Pod를 하나씩 유지시키는 컨트롤러 |
| **Job** | 특정 작업을 1회 수행하고 종료하는 Pod를 관리하는 컨트롤러 |
| **CronJob** | Job을 주기적으로 실행시키는 컨트롤러 |

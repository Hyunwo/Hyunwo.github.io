---
layout: post
title: "Kubernetes 아키텍처: 컴포넌트와 Pod/Deployment 생성 흐름"
date: 2026-08-27
tags: [kubernetes, infra]
categories: [kubernetes]
---

아키텍처 편의 시작이다. 이번 섹션 전체 범위는 Components, Networking, Storage, Logging 네 가지고, 이번 글은 그중 Components — 쿠버네티스를 구성하는 컴포넌트들이 실제로 어떻게 협업하는지를 Pod와 Deployment 생성 과정을 통해 정리한다.

## 전체 아키텍처 한눈에

쿠버네티스는 Master 한 대와 여러 Worker Node로 구성된다.

- **Master의 Control Plane Component**: `etcd`, `kube-scheduler`, `kube-apiserver`, `kube-controller-manager` — 쿠버네티스의 주요 기능을 담당
- **Worker Node의 Worker Component**: `kubelet`, `kube-proxy`, Container Runtime — 컨테이너를 실제로 관리

Control Plane 컴포넌트들은 대부분 Pod 형태로 떠 있는데, Master의 `/etc/kubernetes/manifests` 폴더에 이 컴포넌트들을 만드는 YAML 파일이 있다. 쿠버네티스가 기동될 때 이 파일들을 읽어서 **Static Pod**로 띄운다.

---

## Pod가 만들어지는 과정

`kubectl create`로 Pod를 만들면 무슨 일이 일어나는지 순서대로 보면 각 컴포넌트의 역할이 자연스럽게 이해된다.

![Pod 생성 흐름]({{ site.baseurl }}/assets/images/k8s-architecture/pod_creation_flow.png)

1. **kubectl**로 Pod 생성 명령을 내리면
2. **kube-apiserver**로 전달되고
3. 이 정보가 **etcd**(쿠버네티스의 모든 데이터를 저장하는 DB)에 저장된다
4. **kube-scheduler**는 평소 각 Node의 자원 상태를 체크하면서, 동시에 API Server에 **watch**를 걸어두고 "노드가 배정 안 된 Pod"가 생기는지 감시한다. 새 Pod를 발견하면 지금 자원 상태를 보고 어느 Node로 보낼지 판단해서, Pod에 Node 정보를 붙여준다. 여기까지가 scheduler의 역할이다
5. 각 Node의 **kubelet**도 API Server에 watch를 걸어두고 "자기 Node로 배정된 Pod"가 있는지 확인하고 있다가, 발견하면 그 정보를 가져와 Pod를 만들기 시작한다. Container Runtime에게 컨테이너 생성을 요청하는 게 이 단계다
6. **kube-proxy**(모든 Node에 DaemonSet으로 떠 있음)가 kubelet의 요청을 받아 새로 생긴 컨테이너가 통신 가능하도록 네트워크를 연결해준다

**여기서 짚어야 할 정정 포인트**: kubelet이 컨테이너를 만들 때 Docker에게 요청한다고 설명하는 경우가 많은데, **Kubernetes 1.24부터는 그렇지 않다.** `dockershim`이라는 중간 다리가 제거되면서, kubelet은 지금 CRI(Container Runtime Interface) 표준을 통해 **containerd**나 **CRI-O** 같은 런타임을 호출한다. Docker Desktop으로 개발하더라도, 실제 클러스터 노드에서 Pod를 실행하는 런타임은 Docker Engine이 아니다.

---

## Deployment가 만들어지는 과정

Deployment는 한 단계가 더 있다. Control Plane의 `kube-controller-manager` Pod 안에는 Deployment, ReplicaSet, DaemonSet 같은 여러 컨트롤러 기능이 각각 **스레드** 형태로 돌아가고 있다.

1. `kubectl create deployment --replicas=2`를 실행하면 kube-apiserver를 거쳐 etcd에 저장된다
2. **Deployment 스레드**가 "Deployment 관련 정보가 생기면 알려달라"고 watch를 걸어뒀다가 이를 감지하고, **ReplicaSet을 만들라고 요청**한다
3. **ReplicaSet 스레드**도 마찬가지로 watch로 이를 감지하고, ReplicaSet에 지정된 개수만큼 **Pod를 만들라고 요청**한다
4. 이후 흐름은 앞서 본 Pod 생성 과정과 동일하다 — scheduler가 Node를 배정하고, 각 kubelet이 컨테이너를 만들고, kube-proxy가 네트워크를 연결한다

즉 Deployment → ReplicaSet → Pod로 이어지는 계층 구조가, 실제로는 각 컨트롤러가 서로 **watch로 다음 사람에게 일을 넘기는 릴레이** 형태로 동작하는 셈이다.

---

## 앞으로 이어질 내용: Networking, Storage, Logging

오늘 스크립트에는 컴포넌트 얘기 외에, 아키텍처 편 전체에서 앞으로 다룰 나머지 세 영역에 대한 예고도 담겨 있었다.

**Networking**
- **Pod Network**: 한 Pod 안 여러 컨테이너끼리 어떻게 통신하는지
- **Pod 간 통신**: 별도 CNI 플러그인(이 강의에서는 **Calico**)이 Pod와 Pod 사이의 통신을 어떻게 처리하는지
- **Service Network**: Service를 Pod에 붙였을 때, 설치 시 설정한 모드에 따라 내부적으로 어떻게 동작하는지

**Storage**
- 데이터를 안정적으로 저장하는 방법 세 가지: **hostPath**(Node의 실제 디스크), **클라우드 스토리지**(외부), **서드파티 스토리지 솔루션**(클러스터 내부에 설치)
- 어떤 방식을 쓰든 Volume은 **File / Block / Object** 세 가지 타입으로 나뉘고, 이 특징을 알고 써야 한다

**Logging**
- **Core Pipeline**: Pod에서 생성된 로그가 어떤 구조로 쌓이고, `kubectl logs`로 어떻게 조회하는지
- **Service Pipeline**: 별도 플러그인을 설치하면 각 Node에서 로그를 수집하는 Agent Pod들이 생기고, 이 로그를 한 곳에 모아 Web UI로 보여준다

이 세 영역은 각각 다음 글들에서 자세히 다룰 예정이다. (참고로 이전에 짚었던 kube-proxy의 Proxy Mode 종류도 Service Network를 다룰 때 함께 정리하는 게 더 맞겠다고 판단해서, 이번 글에서는 뺐다.)

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **etcd** | 쿠버네티스의 모든 데이터를 저장하는 key-value 저장소(DB) |
| **kube-apiserver** | 모든 컴포넌트와 사용자가 거쳐가는 유일한 진입점 |
| **kube-scheduler** | Node 자원 상태를 보고 새 Pod를 어느 Node에 배치할지 결정하는 컴포넌트 |
| **kube-controller-manager** | Deployment, ReplicaSet, DaemonSet, HPA 등 여러 컨트롤러가 스레드로 돌아가는 Pod |
| **Static Pod** | Master의 `/etc/kubernetes/manifests`에 있는 YAML을 읽어 기동 시 자동으로 띄우는 Pod |
| **kubelet** | 각 Node에 설치되어 자기 Node의 Pod를 관리하는 에이전트 |
| **kube-proxy** | 모든 Node에 DaemonSet으로 배치되어, Pod의 네트워크 연결을 처리하는 컴포넌트 |
| **Container Runtime** | 실제로 컨테이너를 만들고 삭제하는 구현체. 현재는 containerd, CRI-O 등 CRI 표준 런타임을 사용 (Docker 직접 사용은 1.24부터 불가) |
| **watch** | 컴포넌트가 API Server에 특정 변화가 생기면 알려달라고 걸어두는 감시 방식. 컨트롤러 간 릴레이의 기반 |
| **Calico** | Pod 간 네트워크 통신을 처리하는 CNI 플러그인 (이 강의에서 사용) |

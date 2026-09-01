---
layout: post
title: "Storage 아키텍처: StorageClass, CSI, Storage Type"
date: 2026-08-29
tags: [kubernetes, infra]
categories: [kubernetes]
---

Storage 아키텍처를 정리한다. 8/12 글에서 PV/PVC 기본 개념과 Dynamic Provisioning을 다뤘는데, 이번엔 StorageClass의 두 가지 역할과 실제 Volume Plugin 구성, 그리고 CSI 아키텍처까지 더 들어간다.

## StorageClass의 두 가지 역할

StorageClass는 크게 두 가지 용도로 쓰인다.

**① Grouping**: 이미 만들어진 여러 PV를 그룹으로 묶어서 관리하는 용도. PVC가 특정 StorageClass 이름을 지정하면, 그 그룹에 속한 PV 중에서 조건에 맞는 걸 찾아 연결한다.

**② Dynamic Provisioning**: StorageClass에 **Provisioner**를 지정해두면, PVC가 생성될 때마다 PV를 미리 만들어둘 필요 없이 그 자리에서 자동으로 생성된다. 8/12 글에서 다룬 내용이 바로 이 방식이다.

---

## Volume Plugin: 지금은 CSI가 사실상 표준

강의에서는 Volume Plugin을 hostPath, NFS, Cloud Service(Azure/GCP/AWS), 3rd Party Vendors(CephFS/GlusterFS/StorageOS), CSI(LONGHORN/OpenEBS)로 나눠서 소개했는데, **여기서 확인이 꼭 필요한 부분이 있었다.**

![In-tree Volume Plugin 대부분 제거됨]({{ site.baseurl }}/assets/images/k8s-storage/intree_deprecated_table.png)

hostPath와 CSI를 제외한 나머지는 전부 **in-tree 플러그인**이라, 원래는 쿠버네티스 코드 자체에 내장되어 있었다. 그런데 쿠버네티스가 "모든 스토리지 연동을 CSI 표준으로 통일하자"는 방향으로 옮겨가면서, 이 in-tree 플러그인들이 순차적으로 Deprecated되고 제거됐다.

- **AWS EBS, Azure Disk, GCP PD**: 전부 제거됨 (1.27~1.28). 지금은 각 클라우드의 CSI 드라이버(`ebs.csi.aws.com`, `disk.csi.azure.com`, `pd.csi.storage.gke.io`)를 따로 설치해서 써야 한다
- **OpenStack Cinder, GlusterFS**: 제거됨 (1.26)
- **StorageOS**: 제거됨(1.25)이고, 8/12 글에서 짚었듯 회사 자체가 폐업했다
- **CephFS, Ceph RBD**: 아직 제거되진 않았지만 **1.28부터 Deprecated** 상태라, 신규 구성에는 `ceph-csi`를 쓰는 게 맞다

결국 지금 그대로 유효한 건 **hostPath**(Node 로컬 디스크)와 **CSI 전체**(LONGHORN, OpenEBS, Ceph-CSI 등)뿐이다. CSI 쪽은 처음부터 표준으로 설계됐기 때문에 이 변화와 무관하게 계속 쓸 수 있다.

---

## Storage Type: File / Block / Object

어떤 Volume Plugin을 쓰든, 실제 데이터가 저장되는 방식은 크게 세 가지로 나뉜다.

- **FileStorage**: 파일 시스템 구조로 저장 (NFS 등)
- **BlockStorage**: 디스크 블록 단위로 저장 (Longhorn, EBS 등)
- **ObjectStorage**: 객체 단위로 저장 (S3 계열 등)

이 Storage Type에 따라 지원하는 **Access Mode**가 다르고, 그래서 어울리는 워크로드도 달라진다.

![Storage Type에 따라 어울리는 워크로드가 다르다]({{ site.baseurl }}/assets/images/k8s-storage/storage_type_workload.png)

- **FileStorage/ObjectStorage**: ReadWriteMany를 지원하는 경우가 많아서, 여러 Pod가 동시에 같은 데이터를 봐야 하는 **공유 데이터용**에 적합하다. Deployment로 여러 replica를 띄워도 다 같은 볼륨을 마운트할 수 있다
- **BlockStorage**: 보통 ReadWriteOnce만 지원해서 한 Node에서만 접근 가능하다. Pod마다 **자기 전용 볼륨**이 필요한 **DB 데이터용**에 적합하고, StatefulSet과 짝을 이룬다

만약 BlockStorage 기반 PVC를 ReadWriteMany나 ReadOnlyMany로 요청하면, 대부분의 경우 지원하지 않아서 **PVC 생성 자체가 실패**한다. PVC를 만들기 전에 이 스토리지가 어떤 Access Mode를 지원하는지 먼저 확인해야 하는 이유다.

---

## Longhorn의 CSI 아키텍처

CSI 드라이버 중 하나인 **Longhorn**(BlockStorage)을 예로, 실제로 PVC 뒤에서 어떤 컴포넌트들이 동작하는지 보면 이렇다.

![Longhorn의 CSI 아키텍처]({{ site.baseurl }}/assets/images/k8s-storage/longhorn_csi.png)

CSI 드라이버는 역할에 따라 두 종류의 Plugin으로 나뉜다.

**Controller Plugin** (클러스터 전체에 하나씩):
- **csi-provisioner**: PVC 요청이 들어오면 실제 PV를 생성
- **csi-attacher**: 생성된 Volume을 필요한 Node에 연결
- **csi-resizer**: 볼륨 용량 확장 요청을 처리
- **csi-snapshotter**: VolumeSnapshot(스냅샷) 생성을 처리

**Node Plugin** (각 Worker Node마다 동작):
- **csi-plugin → manager → engine**: 실제로 Volume 데이터를 읽고 쓰는 부분. Longhorn은 여기에 `longhorn-ui`라는 별도 대시보드도 제공해서 볼륨 상태를 눈으로 확인할 수 있다
- **iSCSI**: Engine이 만든 Volume을 Node에 실제 블록 디바이스로 연결해주는 프로토콜

정리하면, PVC 하나를 만드는 게 단순해 보여도 뒤에서는 Controller Plugin이 PV를 만들고 붙이고, Node Plugin이 실제 데이터를 처리하는 구조로 여러 컴포넌트가 협업하고 있는 셈이다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **StorageClass (Grouping)** | 기존에 만들어진 여러 PV를 묶어서 관리하는 용도로 쓰는 방식 |
| **StorageClass (Dynamic Provisioning)** | Provisioner를 지정해서 PVC 생성 시 PV를 자동으로 만들어주는 방식 |
| **In-tree Volume Plugin** | 쿠버네티스 코드 자체에 내장되어 있던 예전 방식의 스토리지 연동. 대부분 제거되고 CSI로 대체됨 |
| **CSI (Container Storage Interface)** | 스토리지 연동을 표준화한 인터페이스. 지금은 이 방식이 사실상 표준 |
| **FileStorage / BlockStorage / ObjectStorage** | 데이터가 저장되는 방식에 따른 분류. 지원하는 Access Mode가 서로 다름 |
| **Controller Plugin** | CSI 드라이버 중 PV 생성·연결·확장·스냅샷을 처리하는 부분 (provisioner/attacher/resizer/snapshotter) |
| **Node Plugin** | CSI 드라이버 중 각 Node에서 실제 Volume 데이터를 읽고 쓰는 부분 |
| **iSCSI** | Longhorn 등에서 Volume을 Node에 블록 디바이스로 연결할 때 쓰는 프로토콜 |

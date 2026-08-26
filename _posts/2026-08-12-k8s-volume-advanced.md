---
layout: post
title: "Volume 심화: PV/PVC, Dynamic Provisioning, ReclaimPolicy"
date: 2026-08-12
tags: [kubernetes, infra]
categories: [kubernetes]
---

초급편에서 배운 Volume(PV, PVC)을 더 깊게 정리한다. 실습편에 "StorageOS는 Deprecated됐다"는 안내가 있었는데, 배경이 생각보다 커서 이 부분부터 짚고 넘어간다.

## 먼저: 강의에 나온 스토리지 솔루션 중 지금은 못 쓰는 것들

- **StorageOS**: Kubernetes 1.22에서 in-tree 플러그인이 Deprecated, 1.25에서 완전히 제거됐다. 회사 자체도 이름을 Ondat으로 바꿨다가 Akamai에 흡수되면서, 사실상 온프레미스용 제품으로는 없어진 상태다. 강의 자료 뒷부분 이미지에는 이미 **Longhorn**으로 대체되어 있었다
- **GlusterFS**: 강의에서 온프레미스 솔루션 예시로 언급됐는데, 이것도 in-tree 플러그인이 **Kubernetes 1.25에서 Deprecated**됐다

지금 새로 구성한다면 Longhorn이나 Ceph 같은 CSI(Container Storage Interface) 드라이버 기반 솔루션을 쓰는 게 맞다. 개념 자체(PV/PVC, Dynamic Provisioning, ReclaimPolicy)는 어떤 솔루션을 쓰든 동일하게 적용되니, 아래 내용은 그대로 유효하다.

---

## Volume은 왜 클러스터와 분리해서 관리하나

Volume은 데이터를 안정적으로 유지하기 위해 쓰는데, 그러려면 실제 데이터는 **쿠버네티스 클러스터와 분리해서** 관리해야 한다. 관리 위치로 나누면:

- **내부망**: Node의 실제 디스크를 쓰는 hostPath/local, 그리고 Node에 설치하는 온프레미스 솔루션(Ceph, Longhorn 등), NFS로 별도 서버를 볼륨으로 쓰는 방식
- **외부망**: AWS, GCP, Azure 같은 클라우드 스토리지

관리자는 저장 용량과 Access Mode를 정해서 **PV(PersistentVolume)**를 만들고, 사용자는 원하는 용량·모드로 **PVC(PersistentVolumeClaim)**를 만들면 쿠버네티스가 알아서 적절한 PV와 연결해준다. Pod는 이 PVC를 사용한다.

## Access Mode: 4가지 (강의에는 3가지)

![Access Mode의 범위]({{ site.baseurl }}/assets/images/k8s-volume-advanced/access_modes.png)

강의에서는 3가지를 다뤘는데, 여기 하나를 더 보충한다.

- **ReadWriteOnce (RWO)**: 한 **Node**에서 읽기·쓰기 가능. 여기서 헷갈리기 쉬운 부분인데, "한 Pod만" 되는 게 아니라 **같은 Node에 있는 여러 Pod는 동시에 마운트할 수 있다**
- **ReadOnlyMany (ROX)**: 여러 Node에서 읽기만 가능
- **ReadWriteMany (RWX)**: 여러 Node에서 읽기·쓰기 모두 가능
- **ReadWriteOncePod (RWOP)**: 강의에는 없던 모드. 클러스터 전체에서 **딱 하나의 Pod만** 마운트할 수 있도록 더 엄격하게 제한한다. RWO로는 막을 수 없는 "같은 Node의 다른 Pod가 실수로 같이 마운트하는" 상황까지 막고 싶을 때 쓴다

모든 볼륨 종류가 이 4가지를 다 지원하는 건 아니라서, 실제로는 사용하려는 볼륨이 어떤 모드를 지원하는지 확인해야 한다.

---

## Dynamic Provisioning: PV를 자동으로

PV를 매번 수동으로 만들고 원하는 스토리지·Access Mode에 맞춰 연결하는 건 번거롭다. **Dynamic Provisioning**을 쓰면 PVC만 만들어도 알아서 맞는 PV가 자동으로 만들어진다.

이걸 지원하는 스토리지 솔루션(Longhorn 등)을 클러스터에 설치하면 여러 오브젝트가 같이 생기는데, 그중 핵심이 **StorageClass**다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast
  resources:
    requests:
      storage: 1Gi
```

PVC의 `storageClassName`에 StorageClass 이름을 넣으면, 그 StorageClass에 연결된 스토리지 솔루션으로 PV가 자동 생성된다. StorageClass는 여러 개 만들 수 있고, 그중 하나를 **default**로 지정해두면 `storageClassName`을 생략했을 때 자동으로 그 StorageClass가 적용된다.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: driver.longhorn.io
```

---

## PV의 Status와 ReclaimPolicy

![PV Status와 ReclaimPolicy]({{ site.baseurl }}/assets/images/k8s-volume-advanced/pv_status_reclaim.png)

PV는 상황에 따라 상태(Status)가 바뀐다.

- **Available**: 갓 만들어져서 아직 어떤 PVC와도 연결 안 된 상태
- **Bound**: PVC와 연결된 상태. 참고로 이 시점에는 아직 실제 볼륨 데이터가 만들어진 게 아니고, **Pod가 이 PVC를 써서 구동될 때** 실제 볼륨이 만들어진다
- **Released**: PVC가 삭제되면서 연결이 끊긴 상태
- **Failed**: PV와 실제 데이터 간 연결에 문제가 생긴 상태

중요한 점: **Pod가 삭제돼도 PVC와 PV는 그대로 유지**된다. 데이터가 날아가려면 PVC까지 삭제해야 한다.

PVC가 삭제됐을 때 PV를 어떻게 처리할지는 **ReclaimPolicy**로 정한다.

- **Retain**: PVC가 삭제되면 PV는 Released 상태가 되고, 데이터는 유지되지만 다른 PVC에 자동으로 재연결되진 않는다. 삭제도 수동으로 해야 한다. **PV를 수동으로 만들었을 때의 기본값**이다
- **Delete**: PVC를 지우면 PV도 같이 지워진다. 볼륨 종류에 따라 실제 데이터까지 지워지기도, 안 지워지기도 한다. **StorageClass로 자동 생성된 PV의 기본값**이다
- **Recycle**: 데이터를 지우고 PV를 Available 상태로 되돌려서 재사용 가능하게 만드는 정책이었는데, **현재 Deprecated 상태라 지금은 쓰지 않는다**

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **PV (PersistentVolume)** | 클러스터에 등록된 실제 스토리지 조각. 관리자가 만들거나 Dynamic Provisioning으로 자동 생성됨 |
| **PVC (PersistentVolumeClaim)** | 사용자가 원하는 용량·Access Mode로 스토리지를 요청하는 오브젝트. 적절한 PV와 자동 연결됨 |
| **Access Mode** | PV를 어떤 범위(Node/Pod)에서 읽기·쓰기할 수 있는지 정의. RWO/ROX/RWX/RWOP |
| **ReadWriteOncePod (RWOP)** | 클러스터 전체에서 단 하나의 Pod만 마운트하도록 제한하는 Access Mode |
| **StorageClass** | Dynamic Provisioning 시 어떤 스토리지 솔루션으로 PV를 만들지 정의하는 오브젝트 |
| **Dynamic Provisioning** | PVC 생성만으로 PV가 자동으로 만들어지는 기능 |
| **PV Status** | PV의 현재 상태 (Available/Bound/Released/Failed) |
| **ReclaimPolicy** | PVC 삭제 시 PV를 어떻게 처리할지 정하는 정책 (Retain/Delete/Recycle). Recycle은 Deprecated |

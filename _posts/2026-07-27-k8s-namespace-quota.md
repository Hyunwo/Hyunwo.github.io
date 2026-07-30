---
layout: post
title: "네임스페이스, ResourceQuota, LimitRange로 자원 나눠 쓰기"
date: 2026-07-27
tags: [kubernetes, infra]
categories: [kubernetes]
---

오늘은 네임스페이스를 조금 더 깊게 보고, ResourceQuota와 LimitRange를 처음 배웠다. 왜 이 두 오브젝트가 필요한지부터 시작하는 게 이해하는 데 훨씬 도움이 됐다.

## 왜 필요한가: 한 팀이 자원을 다 쓰면 다른 팀이 곤란해진다

클러스터는 전체적으로 쓸 수 있는 자원(메모리, CPU)이 정해져 있다. 그 안에 여러 Namespace가 있고, Namespace 안에는 여러 Pod가 있는데, 이 Pod들은 결국 클러스터의 자원을 나눠 쓴다.

문제는 한 Namespace의 Pod가 클러스터 남은 자원을 다 써버리면, 다른 Namespace의 Pod는 자원이 필요할 때 못 받는 상황이 생긴다는 거다. 이걸 막기 위한 게 **ResourceQuota**다. Namespace마다 ResourceQuota를 걸어두면, 그 Namespace의 Pod들이 아무리 자원을 써도 정해진 한계를 못 넘는다. 문제가 생겨도 그 Namespace 안에서 끝나고, 다른 Namespace에는 영향이 없다.

![Namespace별 ResourceQuota]({{ site.baseurl }}/assets/images/k8s-namespace-quota/resourcequota_gauge.png)

그런데 ResourceQuota만으로는 또 다른 문제가 생길 수 있다. 한 Pod가 자원을 너무 크게 요청해버리면, 그 Namespace의 쿼터를 그 Pod 혼자 거의 다 차지해버려서 다른 Pod가 들어올 자리가 없어지는 거다. 이걸 막기 위한 게 **LimitRange**다. Namespace에 들어오는 개별 Pod의 자원 크기 자체를 제한해서, 이런 상황을 막아준다.

> 짚고 넘어갈 부분: 강의에서 "이 두 오브젝트는 클러스터에도 달 수 있다"고 했는데, 이건 정확하지 않다. **ResourceQuota와 LimitRange는 Namespace 전용 오브젝트**라 클러스터 전체에 직접 적용하는 건 안 된다. 클러스터 전체를 관리하고 싶으면 모든 Namespace 각각에 ResourceQuota를 나눠서 걸어주는 방식으로 접근해야 한다.

---

## Namespace: 이름의 유일성과 격리 범위

Namespace 안에서는 같은 타입의 오브젝트끼리 이름이 겹칠 수 없다. Pod마다 UUID가 따로 있긴 하지만, 같은 Namespace 안에서는 이름 자체가 유일한 키 역할을 한다.

또 하나 중요한 특징은, Namespace끼리는 자원이 분리되어 관리된다는 거다. Pod와 Service를 라벨-셀렉터로 연결하는 건 익숙한데, 이 연결은 **같은 Namespace 안에서만** 유효하다. 셀렉터 값과 라벨 값이 우연히 똑같더라도, Namespace가 다르면 연결되지 않는다.

```yaml
# Namespace A의 Pod
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
  namespace: team-a
  labels:
    app: web
---
# Namespace B의 Service (셀렉터 값은 같지만 연결 안 됨)
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: team-b
spec:
  selector:
    app: web
  ports:
    - port: 80
```

지금까지 배운 대부분의 자원은 자신이 속한 Namespace 안에서만 쓸 수 있다. 다만 Node나 PersistentVolume처럼 모든 Namespace에서 공용으로 쓰는 오브젝트도 있다. 그리고 Namespace를 지우면 그 안의 자원도 전부 같이 지워지니, 삭제할 때는 주의가 필요하다.

참고로 Pod의 IP로 다른 Namespace에서 직접 접근하면 **기본적으로는 연결된다.** Namespace가 네트워크 자체를 막는 건 아니고, 진짜로 통신을 제한하고 싶으면 **NetworkPolicy**를 따로 걸어야 한다.

Namespace 자체를 만드는 YAML은 단순하다.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
```

### Namespace가 분리해주는 것과 안 해주는 것

Namespace는 "다 막아주는" 개념이 아니다. 뭐가 분리되고 뭐가 안 되는지 명확히 구분해둘 필요가 있다.

**분리되는 것**
- 라벨-셀렉터 연결: Pod를 다른 Namespace로 옮기면 같은 라벨이어도 Service와 연결이 끊긴다
- 오브젝트 이름: 같은 Namespace 안에서 같은 이름의 Pod를 또 만들면 에러가 난다

**분리 안 되는 것 (그래서 주의해야 하는 것)**
- **Pod IP 직접 접근**: 다른 Namespace여도 Pod IP로 직접 접근하면 그냥 연결된다. Namespace가 IP 트래픽 자체를 막아주진 않는다
- **NodePort**: 30000~32767번 포트 범위는 클러스터 전체가 공유하는 자원이라 Namespace로 나뉘지 않는다
- **hostPath 볼륨**: 특정 Node의 실제 경로를 그대로 마운트하는 방식이라, 같은 Node 위에 있으면 Namespace가 달라도 같은 파일이 그대로 보인다

정리하면 Namespace는 "이름 충돌 방지"와 "라벨 기반 연결 범위"는 확실히 나눠주지만, **네트워크나 Node 자원을 직접 건드리는 부분은 별도로 막아야 한다.**

---

## ResourceQuota: Namespace의 자원 예산

ResourceQuota는 Namespace가 쓸 수 있는 자원의 전체 한계를 정하는 오브젝트다.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    requests.memory: 3Gi
    limits.memory: 6Gi
    requests.cpu: "4"
    limits.cpu: "8"
    pods: "10"
```

여기서 중요한 점 하나. **ResourceQuota가 걸려 있는 Namespace에 Pod를 만들려면, 그 Pod는 반드시 자원 요청(request)과 제한(limit)을 명시해야 한다.** 명시하지 않으면 아예 생성되지 않는다. 그리고 이미 요청 자원의 합이 쿼터에 근접해 있으면, 새로 들어오려는 Pod의 요청까지 더했을 때 한계를 넘는 경우에도 생성이 거부된다.

메모리·CPU뿐 아니라 스토리지, 그리고 Pod 개수 같은 오브젝트 숫자도 제한할 수 있다. 다만 모든 종류의 오브젝트를 다 제한할 수 있는 건 아니고, 쿠버네티스 버전이 올라가면서 제한 가능한 오브젝트 종류가 계속 늘어나는 중이라, 사용하기 전에 현재 버전(현재 최신은 1.36)에서 어떤 오브젝트까지 지원하는지 확인해보는 게 안전하다.

### ResourceQuota를 걸 때는 순서가 중요하다

ResourceQuota 없이 Pod를 두 개 먼저 만들어두고, 그다음에 ResourceQuota를 걸면 **아무 문제 없이 그냥 만들어진다.** "ResourceQuota가 있으면 Pod가 resource 스펙을 필수로 명시해야 한다"는 규칙은 신규로 생성되는 Pod에만 적용되고, 이미 존재하던 Pod는 이 검증을 그냥 통과해버리기 때문이다.

문제는 여기서 시작된다. 예를 들어 Namespace의 쿼터가 1GB인데, 이미 있던 Pod 두 개가 검증 없이 자원을 쓰고 있는 상태에서 새로 1GB짜리 Pod를 하나 더 만들면, **실제로는 쿼터보다 훨씬 많은 자원을 쓰는 상황**이 만들어질 수 있다. ResourceQuota가 신규 생성 건은 확실히 막아주지만, 이미 떠 있던 Pod까지 소급 적용해서 잘라내진 않기 때문이다.

그래서 실무에서 중요한 순서는: **Namespace를 만들면 Pod를 띄우기 전에 ResourceQuota부터 먼저 걸어두는 것.** 순서가 바뀌면 자원 계산이 꼬인 채로 운영하게 될 수 있다.

---

## LimitRange: 개별 Pod 크기의 문지기

LimitRange는 각 Pod가 Namespace에 들어올 수 있는지 자원 크기를 체크해주는 오브젝트다.

![LimitRange가 Pod 크기를 체크하는 모습]({{ site.baseurl }}/assets/images/k8s-namespace-quota/limitrange_gate.png)

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: team-a-limits
  namespace: team-a
spec:
  limits:
    - type: Container
      min:
        memory: "1Gi"
      max:
        memory: "4Gi"
      maxLimitRequestRatio:
        memory: "3"
      defaultRequest:
        memory: "1Gi"
      default:
        memory: "2Gi"
```

체크 항목을 하나씩 보면:

- **min**: 컨테이너의 memory limit이 최소 1GB는 넘어야 한다
- **max**: memory limit이 4GB를 초과할 수 없다
- **maxLimitRequestRatio**: request 대비 limit의 비율이 여기 설정한 값(3배)을 넘으면 안 된다
- **defaultRequest / default**: Pod에 아무 스펙도 안 넣었을 때 자동으로 채워지는 request/limit 값

예를 들어 위 설정 기준으로:

- Pod 1이 memory limit을 5GB로 요청 → max(4GB)를 넘어서 **거부**
- Pod 2가 request 1GB / limit 4GB로 요청 → 비율이 4배라서 허용치(3배)를 넘어 **거부**
- Pod 3가 request 1GB / limit 2GB로 요청 → 비율 2배, max 이내라 **통과**

LimitRange의 `type`은 Container 단위뿐 아니라 PersistentVolumeClaim 단위로도 설정할 수 있는데, 타입마다 지원하는 옵션이 다르니 이 부분도 필요할 때 문서를 확인하는 게 좋을 것 같다.

### LimitRange는 하나만 쓰는 게 안전하다

request:limit 비율을 5로 설정하면 (허용치 3을 넘어서) 에러가 난다. limit을 낮추고 request를 높여서 비율을 2로 맞추면 정상적으로 만들어진다 — 여기까지는 앞서 설명한 규칙 그대로다.

문제는 **한 Namespace에 LimitRange를 두 개 만들 수도 있다는 점**이다. 이것도 에러 없이 그냥 만들어진다. 만약 두 LimitRange의 max 값이 각각 0.3GB, 0.5GB로 다르면, Pod를 만들 때 **더 작은(엄격한) 쪽인 0.3GB 기준으로 적용**된다. default 값도 두 LimitRange가 서로 다르게 설정되어 있으면, 어느 쪽 default가 적용되는지 미리 예측하기 어렵다.

즉 **한 Namespace에 LimitRange를 여러 개 둘 수는 있지만, 그러면 예상치 못한 조합으로 동작할 수 있다.** 그래서 실무에서는 Namespace당 LimitRange를 하나만 쓰는 게 안전하다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Namespace** | 오브젝트 이름의 유일성을 보장하고, 자원을 분리해서 관리하는 단위 |
| **ResourceQuota** | Namespace 전체가 쓸 수 있는 자원(메모리, CPU, 오브젝트 개수 등)의 상한을 정하는 오브젝트. Namespace 전용 |
| **LimitRange** | Namespace에 들어오는 개별 Pod/컨테이너의 자원 크기(min/max/비율)를 제한하는 오브젝트. Namespace 전용 |
| **maxLimitRequestRatio** | LimitRange에서 request 대비 limit의 최대 허용 배수를 정하는 값 |
| **defaultRequest / default** | Pod에 자원 스펙이 없을 때 자동으로 채워지는 request/limit 기본값 |
| **NetworkPolicy** | Namespace 간, Pod 간 네트워크 통신을 실제로 제한할 때 사용하는 오브젝트 |
| **NodePort** | Node의 30000~32767번 포트를 열어 외부 접근을 허용하는 Service 타입. 포트 범위는 Namespace로 나뉘지 않고 클러스터 전체가 공유 |
| **hostPath** | Node의 특정 디스크 경로를 그대로 Pod에 마운트하는 볼륨 타입. 같은 Node면 Namespace가 달라도 파일이 공유됨 |

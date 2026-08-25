---
layout: post
title: "Autoscaler: HPA, VPA, CA와 HPA 아키텍처"
date: 2026-08-25
tags: [kubernetes, infra]
categories: [kubernetes]
---

쿠버네티스의 오토스케일러는 HPA, VPA, CA 세 가지로 나뉜다. 각각 뭘 늘리는지부터, 실무에서 가장 많이 쓰는 HPA의 내부 아키텍처와 계산 공식까지 정리한다.

## 3가지 Autoscaler: 뭘 늘리는가

![3가지 Autoscaler]({{ site.baseurl }}/assets/images/k8s-autoscaler/autoscaler_overview.png)

- **HPA (Horizontal Pod Autoscaler)**: Pod **개수**를 늘리거나(Scale Out) 줄인다(Scale In)
- **VPA (Vertical Pod Autoscaler)**: Pod 하나의 **자원(CPU/메모리)**을 늘리거나(Scale Up) 줄인다(Scale Down)
- **CA (Cluster Autoscaler)**: **Node 자체**를 추가하거나 제거한다

### HPA: 트래픽 증가 → Pod 증가

컨트롤러가 관리하는 Pod의 자원이 한계에 다다르면, HPA가 이를 감지하고 컨트롤러의 `replicas`를 늘려서 Pod를 하나 더 만든다. 반대로 자원 사용량이 줄면 Pod를 줄인다. 권장 조건은 두 가지다.

- **기동이 빠른 앱**: 장애 상황에서 빠른 복구가 중요하기 때문
- **Stateless 앱**: HPA는 어떤 Pod가 master 역할인지, slave 역할인지 구분하지 못한다. 그냥 양적으로 늘리고 줄일 뿐이라, 역할이 있는 Stateful 앱에는 안 맞는다

### VPA: Stateful 앱을 위한 대안

Stateful 앱처럼 Pod마다 역할이 있어서 "아무 Pod나 늘리면" 안 되는 경우, VPA를 쓴다. 자원이 부족해지면 Pod를 재시작시키면서 리소스 자체를 키운다. **한 컨트롤러에 HPA와 VPA를 동시에 달면 충돌해서 정상 동작하지 않는다.**

### CA: Node 자체가 부족할 때

모든 Node의 자원이 소진돼서 스케줄러가 Pod를 어디에도 배치할 수 없으면, 스케줄러가 CA에게 Node를 만들어달라고 요청한다. CA가 클라우드 프로바이더(AWS/GCP/Azure 등)와 연동되어 있다면 실제로 Node를 하나 만들어준다. 반대로 자원이 남으면 Node를 제거해서 비용을 아낀다.

---

## HPA 아키텍처: 정정할 부분이 있다

강의에서 HPA가 어떻게 동작하는지 설명하는 아키텍처 그림이 있었는데, **버전이 오래돼서 지금은 안 맞는 부분이 두 군데** 있었다.

![HPA 아키텍처 정정판]({{ site.baseurl }}/assets/images/k8s-autoscaler/hpa_architecture_fixed.png)

**1. 컨테이너 런타임으로 Docker를 쓴다는 부분**

강의에서는 kubelet이 Docker(또는 rkt, CoreOS)에게 컨테이너를 만들어달라고 요청한다고 설명했는데, **Kubernetes 1.24(2022년)부터 Docker를 직접 컨테이너 런타임으로 쓸 수 없다.** `dockershim`이라는 중간 다리가 제거되면서, 지금은 CRI(Container Runtime Interface) 표준을 따르는 **containerd**나 **CRI-O** 같은 런타임만 쓸 수 있다. 참고로 `rkt`와 `CoreOS`(Container Linux)는 둘 다 2020년에 프로젝트 자체가 종료됐다.

cAdvisor(리소스 측정 도구)도 "Docker로부터 측정"하는 게 아니라, 지금은 **CRI를 통해 어떤 런타임에서든** 메모리·CPU 정보를 가져온다.

**2. VPA가 Controller Manager 안에서 스레드로 돈다는 부분**

**HPA는 실제로 kube-controller-manager에 내장된 기능**이 맞다. 하지만 **VPA는 core API에 포함되어 있지 않고 별도로 설치해야 하는 애드온**이다. recommender, updater, admission-controller라는 3개의 독립된 Pod로 구성되어 있어서, Deployment/ReplicaSet/DaemonSet/HPA처럼 Controller Manager 안에 같이 있는 게 아니다. CA도 마찬가지로 별도 설치하는 컴포넌트다.

---

## HPA가 Pod 상태를 아는 과정

1. **cAdvisor**가 kubelet 안에서 각 컨테이너의 메모리·CPU 사용량을 측정한다
2. **metrics-server**(애드온으로 설치 필요)가 각 Node의 kubelet에서 이 정보를 가져와 **kube-apiserver에 등록**한다
3. **HPA**가 기본 15초마다 kube-apiserver를 통해 이 정보를 조회하고, 기준을 넘으면 컨트롤러의 `replicas`를 조정한다
4. `kubectl top` 명령도 이 Resource API를 통해 같은 정보를 조회하는 것이다
5. 단순 CPU/메모리 외에 패킷 수, Ingress 요청량 같은 지표로 스케일링하고 싶다면 **Prometheus** 같은 걸 설치해서 Custom/External API로 HPA에 트리거를 제공할 수 있다

---

## HPA 스케일링 공식

HPA는 기준을 넘었다고 무조건 Pod 하나만 늘리는 게 아니라, 정해진 공식으로 몇 개를 늘릴지 계산한다.

![HPA 스케일링 공식]({{ site.baseurl }}/assets/images/k8s-autoscaler/hpa_formula.png)

```
desiredReplicas = ceil( currentReplicas × currentValue ÷ targetValue )
```

- **Scale Out 예시**: replicas 2개, 평균 CPU 300m, target 100m(request 200m 기준 Utilization 50%) → `ceil(2×300÷100) = 6`. Pod가 2개에서 6개로 늘어난다
- **Scale In 예시**: replicas 6개, 평균 CPU 50m, target 100m → `ceil(6×50÷100) = 3`. 계속 낮으면 다음번엔 `ceil(3×50÷100) = 2`가 되는데, 이게 `minReplicas`라면 더 이상 줄지 않는다

---

## HPA YAML 예시

현재 안정 버전은 `autoscaling/v2`다.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: stateless-app1
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

`metrics.type`에는 Pod의 `resources`를 보는 **Resource**, Pod 단위 커스텀 지표를 보는 **Pods**, Ingress 같은 다른 오브젝트의 지표를 보는 **Object** 타입이 있다. Resource 타입의 target에는 비율로 보는 **Utilization**, 실측값 평균을 보는 **AverageValue**, 단순 값을 보는 **Value** 중 선택할 수 있다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **HPA** | Pod 개수를 자동으로 늘리고 줄이는 오토스케일러. core Kubernetes API(kube-controller-manager)에 내장 |
| **VPA** | Pod의 자원(CPU/메모리)을 자동으로 늘리고 줄이는 오토스케일러. 별도 설치 필요, Stateful 앱에 권장 |
| **CA** | 클러스터의 Node 자체를 자동으로 추가·제거하는 오토스케일러. 클라우드 프로바이더 연동 필요 |
| **containerd / CRI-O** | 현재 Kubernetes에서 사용하는 CRI 표준 컨테이너 런타임. Docker는 1.24부터 직접 사용 불가 |
| **cAdvisor** | kubelet에 포함된 리소스 측정 도구. CRI를 통해 컨테이너의 메모리·CPU 사용량을 수집 |
| **metrics-server** | 각 Node의 자원 사용량을 모아 kube-apiserver에 등록하는 애드온. HPA 사용에 필수 |
| **kube-apiserver** | 모든 컴포넌트가 통신하는 진입점. Resource/Custom/External API로 메트릭도 여기서 조회 |
| **desiredReplicas 공식** | `ceil(currentReplicas × currentValue ÷ targetValue)`로 HPA가 목표 Pod 수를 계산하는 방식 |

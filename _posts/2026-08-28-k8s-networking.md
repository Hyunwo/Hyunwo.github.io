---
layout: post
title: "Kubernetes 네트워킹: Pod Network와 Service Network"
date: 2026-08-28
tags: [kubernetes, infra]
categories: [kubernetes]
---

네트워킹 아키텍처를 정리한다. 네트워킹은 워낙 기술 범위가 넓어서, 세부 프로토콜 하나하나보다는 **쿠버네티스가 네트워크를 다루는 전체 흐름**에 집중한다. 이 강의는 **Calico**라는 CNI 플러그인을 기준으로 설명하는데, 클라우드 환경이나 다른 플러그인을 쓰면 세부 동작은 달라질 수 있다.

네트워킹은 크게 두 영역으로 나뉜다.

- **Pod Network**: Pod 안 컨테이너 간 통신, Pod와 Pod 간 통신
- **Service Network**: Service를 통해 Pod에 접근하는 부분

---

## Pod 안 컨테이너들은 어떻게 통신하는가

Pod를 만들면 내가 지정한 컨테이너 말고도 **Pause Container**라는 게 자동으로 하나 더 생긴다. 이 컨테이너가 네트워크 인터페이스와 IP를 가지고 있고, 쿠버네티스는 이 Pause Container의 **네트워크 네임스페이스를 Pod 안의 모든 컨테이너가 공유**하도록 구성한다.

![Pod 안 컨테이너들은 어떻게 같은 IP를 쓰는가]({{ site.baseurl }}/assets/images/k8s-networking/pod_network_pause.png)

그 결과 Pod 안의 컨테이너들은 **같은 IP를 공유**하고, 서로는 **포트**로 구분해서 접근한다(`localhost:포트`). Worker Node의 Host Network Namespace에는 Pod마다 가상 인터페이스가 하나씩 생겨서, Pause Container의 인터페이스와 **1:1로 연결**된다.

---

## Pod끼리는 어떻게 통신하는가: CNI가 필요한 이유

서로 다른 Pod 간의 통신은 각 Node에 설치된 **네트워크 플러그인**이 담당한다. 여기서 짚고 갈 부분이 있다.

> **정정**: 강의에서는 "쿠버네티스가 기본 제공하는 Kube-Proxy라는 네트워크 플러그인이 있는데 기능이 제한적이라 잘 안 쓴다"고 했는데, 이건 두 가지가 섞인 설명이다. 첫째, kube-proxy는 Pod 간 통신을 담당하는 네트워크 플러그인이 아니라 **Service 트래픽을 처리하는 컴포넌트**다(아래에서 다룬다). 실제로 설명하려던 "기본 브릿지 기반 네트워크"는 **kubenet**이라는 별개의 기능이다. 둘째, 더 중요한 건 **이 kubenet 자체가 Kubernetes 1.24부터 완전히 제거**됐다는 점이다. 그래서 지금은 "기본 네트워크만 쓰고 CNI는 선택"이 아니라, **CNI 플러그인 설치가 사실상 필수**다.

CNI(Container Network Interface)를 통해 Calico, Cilium, Flannel 같은 다양한 오픈소스 네트워크 플러그인을 설치할 수 있고, 플러그인마다 제공 방식과 기능이 다르기 때문에 스펙을 잘 보고 골라야 한다. (참고로 Flannel과 함께 자주 언급되던 **Weave Net**은, 이걸 만들던 회사 Weaveworks가 2024년 2월에 폐업하면서 사실상 유지보수가 멈춘 상태다. 신규 구성에는 추천하기 어렵다.)

### Calico를 썼을 때: 같은 Node 안에서

Calico를 쓰면 가상 인터페이스가 **Router에 바로 연결**되는 구조다. 같은 Node 안의 Pod끼리는 이 Router가 통신을 처리해주고, kubenet 방식보다 훨씬 넓은 CIDR 범위를 써서 한 Node에 더 많은 Pod IP를 할당할 수 있다.

### Calico를 썼을 때: 다른 Node에 있는 Pod와

Router 위에는 **Overlay Network** 계층이 있고, IPIP 또는 VXLAN 방식으로 동작한다. 이 계층이 있어야 다른 Node에 있는 Pod와도 통신할 수 있다.

![Calico를 썼을 때 노드 간 Pod 통신]({{ site.baseurl }}/assets/images/k8s-networking/calico_cross_node.png)

Pod D가 다른 Node에 있는 Pod B(IP: `20.111.156.7`)를 호출하면:

1. Pod D의 트래픽이 가상 인터페이스를 거쳐 Router로 간다
2. Router의 라우팅 테이블에 이 IP가 없으므로 Overlay Network 계층으로 올라간다
3. Calico는 이 IP가 어느 Node에 있는지 알고 있어서, 패킷을 **목적지 Node의 IP로 캡슐화(Encapsulation)**한다. 실제 Pod IP는 캡슐 안에 숨겨진다
4. 목적지 Node에 도착하면 Overlay Network 계층에서 **디캡슐화(Decapsulation)**해서 원래 Pod IP를 복원한다
5. 그 Node의 Router가 해당 IP의 가상 인터페이스로 전달하면서 Pod B에 도착한다

---

## Service Network: Service가 진짜로 하는 일

Pod에 Service를 붙이면 Service도 고유 IP를 갖고, 이 이름과 IP가 **kube-DNS**에 등록된다. 그리고 API Server는 각 Node에 DaemonSet으로 떠 있는 **kube-proxy**에게 "이 Service IP는 이 Pod IP로 연결된다"는 정보를 전달한다. Pod가 정상적으로 기동되면 **Endpoint**라는 오브젝트가 생겨서 이 실제 연결 정보를 담당한다.

Service IP를 Pod IP로 바꿔주는 게 **NAT** 기능인데, 이걸 실제로 어떻게 처리하는지가 **Proxy Mode**다. 여기도 최신 버전 기준으로 짚어야 할 부분이 있다.

![kube-proxy Proxy Mode]({{ site.baseurl }}/assets/images/k8s-networking/proxy_mode_fixed.png)

- **Userspace**: 모든 트래픽이 kube-proxy 프로세스를 직접 거쳐야 해서 성능·안정성이 떨어져 예전부터 잘 안 쓰였는데, **Kubernetes 1.26에서 아예 제거**됐다
- **iptables**: kube-proxy가 매핑 정보를 iptables에 직접 등록하는 방식. **1.36까지는 기본 모드였지만, 1.37부터는 기본값 자리를 nftables에 넘겼다**
- **IPVS**: 리눅스의 L4 로드밸런서 기능을 활용해서 iptables보다 나은 성능(특히 부하가 클 때)을 내던 방식인데, **1.35부터 Deprecated**됐고 **1.37부터는 `KubeProxyIPVS` feature gate로 여러 릴리즈에 걸친 정식 제거 절차가 시작**됐다
- **nftables**: iptables의 성능 한계를 개선한 모드로 **1.33부터 stable**이었는데, **Kubernetes 1.37부터 kube-proxy의 기본값**이 됐다

정리하면 **현재(1.37) 기준 기본값은 nftables**이고, iptables는 이전 버전과의 호환을 위해 계속 선택 가능한 모드로 남아있다. IPVS는 제거 절차가 진행 중이라 신규 클러스터에는 쓰지 않는 게 좋다.

### Calico + Service: ClusterIP와 NodePort

Calico를 쓸 때는 이 Router 부분에 Service IP를 Pod IP로 바꿔주는 NAT 기능이 포함된다.

- **ClusterIP**: Pod가 Service IP로 트래픽을 보내면, Router의 NAT에서 곧바로 매칭되는 Pod IP로 변환되고, 그다음부터는 앞서 본 Overlay Network를 통한 Pod 간 통신과 동일하게 처리된다
- **NodePort**: 모든 Node의 kube-proxy가 자기 Node의 30000번대 포트를 열어두고, 외부에서 이 포트로 들어온 트래픽을 kube-proxy가 설정해둔 규칙(nftables 또는 iptables)이 감지해서 Calico 네트워크 플러그인으로 넘긴다. 이후 흐름은 ClusterIP와 동일하게 NAT를 거쳐 Pod 네트워크 영역으로 들어간다

Service를 삭제하면 API Server가 이를 감지해서 kube-proxy에게 관련 설정을 지우라고 지시한다. 결국 Service 오브젝트의 실체는 **NAT 영역의 설정값**인 셈이다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Pause Container** | Pod 생성 시 자동으로 만들어져 네트워크 네임스페이스를 제공하는 컨테이너 |
| **CNI (Container Network Interface)** | 다양한 네트워크 플러그인을 설치할 수 있게 해주는 표준 인터페이스 |
| **kubenet** | CNI 없이 쓰던 쿠버네티스 기본 브릿지 네트워크 방식. Kubernetes 1.24부터 완전히 제거됨 |
| **Calico** | CNI 플러그인 중 하나. Router + Overlay Network 구조로 Pod 간 통신을 처리 |
| **Overlay Network (IPIP/VXLAN)** | 서로 다른 Node에 있는 Pod끼리 통신 가능하게 해주는 캡슐화 계층 |
| **캡슐화 / 디캡슐화** | 실제 Pod IP를 감추고 목적지 Node IP로 감싸서 보내는 것 / 도착 후 원래 IP로 복원하는 것 |
| **Endpoint** | Service와 Pod의 실제 연결 상태를 담당하는 오브젝트 |
| **kube-DNS** | Service 이름과 IP를 등록해서 도메인 이름으로 조회할 수 있게 해주는 DNS |
| **Proxy Mode** | kube-proxy가 Service IP를 Pod IP로 바꾸는 NAT 처리 방식. Kubernetes 1.37부터 nftables가 기본값, iptables는 선택 가능, IPVS는 제거 진행 중 |

---
layout: post
title: "쿠버네티스 개념 지도 & 용어 사전"
date: 2026-08-11
tags: [kubernetes, infra, reference]
categories: [kubernetes]
---

![Kubernetes 학습 지도]({{ site.baseurl }}/assets/images/k8s-glossary/k8s_learning_map.png)

학습 지도가 "어떤 주제들이 있는지"를 보여준다면, 아래 흐름도는 그 개념들이 **실제로 어떤 순서로 동작하는지**를 보여준다. Pod 하나가 만들어져서 트래픽을 받기까지의 과정으로 엮었다.

![Pod 하나가 태어나서 트래픽을 받기까지]({{ site.baseurl }}/assets/images/k8s-glossary/pod_full_flow.png)

---

## 기초 개념

| 용어 | 설명 |
|---|---|
| **Hypervisor** | 하나의 물리 서버에서 여러 VM을 동시에 실행할 수 있게 해주는 가상화 소프트웨어 |
| **Guest OS** | VM 안에 개별적으로 설치되는 OS |
| **컨테이너 런타임** | 컨테이너를 만들고 실행/관리하는 소프트웨어 (예: Docker) |
| **컨테이너 이미지** | 서비스 코드와 실행에 필요한 라이브러리를 함께 묶은 패키지 |
| **namespace (리눅스 커널)** | 프로세스, 네트워크 등 커널 영역을 격리하는 리눅스 커널 기능 |
| **cgroups** | CPU, 메모리 등 자원 사용량을 제한하는 리눅스 커널 기능 |
| **Pod** | 1개 이상의 컨테이너를 담는 쿠버네티스 최소 배포 단위 |
| **사이드카(Sidecar)** | 메인 컨테이너를 보조하는 역할로 같은 Pod에 함께 배치되는 컨테이너 |

## 클러스터 & 네임스페이스

| 용어 | 설명 |
|---|---|
| **Cluster** | Master(Control Plane) 한 대와 Node 여러 대로 구성된 쿠버네티스 시스템 전체 |
| **Master / Control Plane** | 클러스터 전체를 컨트롤하는 서버. "마스터"는 구 명칭, 현재는 Control Plane이 공식 용어 |
| **Node** | 컨테이너가 실행될 자원을 제공하는 서버 |
| **Namespace** | 오브젝트 이름의 범위를 나누는 단위. 기본적으로 네트워크 자체를 막지는 않음 |
| **ResourceQuota** | Namespace 전체가 쓸 수 있는 자원 총량의 상한을 정하는 오브젝트. Namespace 전용 |
| **LimitRange** | Namespace에 들어오는 개별 Pod/컨테이너의 자원 크기를 제한하는 오브젝트. Namespace 전용 |
| **maxLimitRequestRatio** | LimitRange에서 request 대비 limit의 최대 허용 배수 |
| **defaultRequest / default** | LimitRange에서 Pod에 자원 스펙이 없을 때 자동으로 채워지는 기본값 |
| **NetworkPolicy** | Namespace 간, Pod 간 네트워크 통신을 실제로 제한할 때 쓰는 오브젝트 |

## 설정 & 데이터

| 용어 | 설명 |
|---|---|
| **Volume** | Pod가 재생성돼도 데이터가 유지되도록 별도로 저장하는 공간 |
| **ConfigMap** | 민감하지 않은 설정값을 컨테이너에 주입할 때 사용하는 오브젝트 |
| **Secret** | 민감한 설정값(비밀번호 등)을 저장하는 오브젝트. base64로 인코딩해서 저장 |
| **base64** | Secret 값을 저장할 때 쓰는 인코딩 규칙. 암호화가 아니라 형식 변환일 뿐 |
| **envFrom / valueFrom** | ConfigMap·Secret의 값을 컨테이너 환경 변수로 가져오는 필드 |
| **tmpfs** | 메모리 기반 파일시스템. Secret을 볼륨으로 마운트할 때 디스크 대신 여기 올라감 |
| **etcd** | 쿠버네티스 오브젝트(ConfigMap, Secret 포함)가 실제로 저장되는 데이터베이스 |

## Label과 Selector

| 용어 | 설명 |
|---|---|
| **Label** | 오브젝트에 붙이는 key-value 쌍. 분류와 선택(selector 매칭) 용도 |
| **Selector** | 특정 라벨을 가진 오브젝트만 골라 연결할 때 쓰는 조건 |
| **matchLabels** | key-value가 정확히 일치하는 오브젝트만 선택하는 selector 방식 |
| **matchExpressions** | Exists/DoesNotExist/In/NotIn(NodeAffinity는 Gt/Lt 추가) 연산자로 세밀하게 선택하는 방식 |

## 컨트롤러

| 용어 | 설명 |
|---|---|
| **ReplicationController** | Pod 개수를 유지해주는 가장 기본적인 컨트롤러. 현재 Deprecated |
| **ReplicaSet** | ReplicationController를 대체하는 오브젝트. matchExpressions 등 확장된 selector 지원 |
| **template** | 컨트롤러 안에 포함되는 Pod 스펙. Pod가 죽으면 이 내용으로 재생성됨 |
| **replicas** | 컨트롤러가 유지해야 할 Pod 개수 |
| **Deployment** | Pod의 배포와 업데이트를 관리하는 컨트롤러. 내부적으로 ReplicaSet을 만들어 운용 |
| **Recreate** | 기존 Pod를 모두 삭제한 뒤 새 버전 Pod를 생성하는 배포 전략. 다운타임 발생 |
| **RollingUpdate** | 새 버전 Pod를 하나씩 만들고 기존 Pod를 하나씩 지우며 점진적으로 교체. 다운타임 없음 |
| **maxSurge / maxUnavailable** | RollingUpdate 중 초과 생성/동시 중단 가능한 Pod 수를 지정하는 값 |
| **Blue-Green** | 새 버전 그룹을 통째로 띄운 뒤 Service selector를 한 번에 전환하는 배포 패턴 |
| **Canary** | 일부 트래픽만 새 버전으로 흘려 검증한 뒤 점진적으로 확대하는 배포 패턴 |
| **revisionHistoryLimit** | 업데이트 후 replicas 0으로 남는 과거 ReplicaSet을 몇 개까지 보관할지 지정 |
| **minReadySeconds** | Pod가 Ready 상태 후 정상 사용 가능하다고 최종 인정하기까지 대기 시간 |
| **pod-template-hash** | Deployment가 template 기준으로 자동 계산해 ReplicaSet/Pod에 붙이는 라벨. 버전별 구분용 |
| **DaemonSet** | Node의 자원 상태와 무관하게 모든 Node에 Pod를 하나씩 배치하는 컨트롤러 |
| **hostPort** | Node의 특정 포트를 Pod에 직접 연결하는 설정 |
| **Job** | 특정 작업을 완료하면 종료되는 Pod를 관리하는 컨트롤러 |
| **completions / parallelism** | Job의 총 완료 필요 Pod 수 / 동시 실행 가능 Pod 수 |
| **activeDeadlineSeconds** | Job의 최대 허용 실행 시간. 초과 시 전체 Pod 삭제 |
| **backoffLimit** | Job의 Pod 실패 시 재시도 가능한 최대 횟수 |
| **CronJob** | Job을 지정 주기(schedule)마다 자동 생성하는 컨트롤러 |
| **concurrencyPolicy** | 이전 스케줄 Job이 안 끝났을 때 처리 방식 (Allow/Forbid/Replace) |
| **HorizontalPodAutoscaler (HPA)** | 리소스 지표를 보고 replicas 값을 자동 조정하는 오브젝트 |
| **Ingress Controller** | 유입 트래픽을 URL 경로 등 규칙에 따라 다른 Service로 라우팅해주는 컴포넌트 |

## Pod 생명주기 & 안정성

| 용어 | 설명 |
|---|---|
| **Phase** | Pod 전체를 대표하는 요약 상태 (Pending/Running/Succeeded/Failed/Unknown) |
| **Conditions** | Pod가 각 단계를 통과했는지 나타내는 체크리스트 (PodScheduled/Initialized/ContainersReady/Ready) |
| **Container State** | 개별 컨테이너 상태 (Waiting/Running/Terminated) |
| **Init Container** | 본 컨테이너 실행 전에 먼저 실행되는 초기화용 컨테이너. Node 배정(PodScheduled) 이후 실행됨 |
| **CrashLoopBackOff** | 컨테이너가 반복적으로 크래시·재시작되는 상황을 나타내는 Reason |
| **readinessProbe** | 컨테이너가 트래픽을 받을 준비가 됐는지 확인. 실패 시 Service 트래픽 대상에서 제외 |
| **livenessProbe** | 컨테이너가 살아있는지 확인. 실패 시 컨테이너 재시작 (Pod 이름·IP는 유지) |
| **startupProbe** | 느리게 시작하는 컨테이너용 probe. 성공 전까지 readiness/liveness는 대기 |
| **httpGet / exec / tcpSocket / grpc** | probe의 체크 방식. grpc는 Kubernetes 1.27부터 stable |
| **initialDelaySeconds / periodSeconds / timeoutSeconds** | probe 최초 지연 / 반복 간격 / 응답 대기 시간 |
| **successThreshold / failureThreshold** | probe 연속 성공/실패 인정 횟수 |
| **QoS Class** | Pod의 resources 설정에 따라 자동 부여되는 등급 (Guaranteed/Burstable/BestEffort) |
| **Guaranteed** | 모든 컨테이너에 requests=limits 설정된 Pod. 자원 부족 시 가장 나중에 축출 |
| **Burstable** | requests/limits는 있지만 Guaranteed 조건 미충족. 두 번째로 축출 |
| **BestEffort** | requests/limits가 전혀 없는 Pod. 가장 먼저 축출 |
| **OOM Score** | 같은 등급 내 축출 순서 기준. request 대비 실사용률이 높을수록 먼저 축출 |

## 스케줄링

| 용어 | 설명 |
|---|---|
| **NodeName** | Node를 이름으로 직접 지정. 스케줄러를 거치지 않음 |
| **NodeSelector** | Node 라벨과 key-value가 정확히 일치해야 배치되는 방식. 매칭 없으면 Pending |
| **NodeAffinity** | matchExpressions로 세밀한 조건을 주는 Node 선택 방식 |
| **requiredDuringSchedulingIgnoredDuringExecution** | 조건을 반드시 만족해야 배치되는 강제 옵션 |
| **preferredDuringSchedulingIgnoredDuringExecution** | 조건을 선호할 뿐 필수는 아닌 옵션. weight로 우선순위 조정 |
| **weight** | preferred 조건의 선호도 점수(1~100). 자원 점수와 합산되어 최종 배치 결정 |
| **PodAffinity / PodAntiAffinity** | 특정 라벨의 Pod와 같은/다른 Node(또는 topology 범위)에 배치되도록 하는 설정 |
| **topologyKey** | PodAffinity/AntiAffinity에서 "어느 범위의 Node까지 볼지" 정하는 Node 라벨 키 |
| **Taint** | Node에 거는 제한. 매칭되는 Toleration 없는 Pod는 배치 안 됨 |
| **Toleration** | Pod가 특정 Taint를 감내할 수 있음을 표시. Node를 찾아가는 기능은 아님 |
| **tolerationSeconds** | NoExecute Taint가 붙었을 때 Toleration 있는 Pod를 얼마나 더 유지할지 지정 |

## 네트워킹 & 서비스

| 용어 | 설명 |
|---|---|
| **Service** | Pod에 고정 IP를 붙여주는 오브젝트. 타입에 따라 접근 범위가 다름 |
| **ClusterIP** | 기본 타입. 클러스터 내부(Node)에서만 접근 가능 |
| **NodePort** | 모든 Node에 30000~32767 포트를 열어 내부망에서 접근 가능하게 함 |
| **LoadBalancer** | 클라우드 로드밸런서를 자동 생성해 외부 인터넷에서 접근 가능하게 함 |
| **FQDN** | Fully Qualified Domain Name. 쿠버네티스가 Service/Pod에 붙이는 전체 도메인 이름 규칙 |
| **CoreDNS** | 클러스터 내부에서 Service/Pod 이름을 IP로 변환해주는 DNS 서버 |
| **Headless Service** | `clusterIP: None`으로 만들어 Pod IP를 직접 반환하는 Service |
| **hostname / subdomain** | Pod가 Headless Service를 통해 자신만의 도메인 이름을 갖도록 설정하는 필드 |
| **Endpoints** | Service·Pod의 연결 정보를 담던 오브젝트. Kubernetes 1.33부터 Deprecated |
| **EndpointSlice** | Endpoints를 대체하는 현재 표준 오브젝트 |
| **ExternalName** | Service를 외부 도메인과 연결(CNAME)해주는 타입. Pod 수정 없이 연동 대상 변경 가능 |

---

앞으로 새 글을 쓸 때마다 이 표에 이어서 추가해나가면, 나중에 이력서나 면접 준비할 때 빠르게 훑어보는 용도로도 쓸 수 있을 것 같다.

---
layout: post
title: "로깅/모니터링 아키텍처: Core Pipeline과 Cluster-level 로깅"
date: 2026-08-30
tags: [kubernetes, infra]
categories: [kubernetes]
---

로깅과 모니터링 아키텍처를 정리한다. 쿠버네티스에서 **로깅**은 앱이 남기는 로그 데이터, **모니터링**은 CPU·메모리 같은 자원 지표를 말한다. 쿠버네티스가 기본으로 제공하는 **Core Pipeline**과, 플러그인을 설치해서 강화하는 **Service Pipeline** 두 가지로 나뉜다.

## Core Pipeline: 쿠버네티스가 기본 제공하는 부분

**모니터링**은 이전에 HPA를 정리할 때 나온 흐름과 같다.

1. 각 Node의 kubelet이 **cAdvisor**를 통해 CPU·메모리 정보를 가져온다
2. **metrics-server**가 이 정보를 모은다
3. `kubectl top` 명령으로 API Server를 통해 이 정보를 조회할 수 있다

**로깅**은 `kubectl logs` 명령으로 kubelet을 거쳐 해당 컨테이너의 로그 파일을 바로 조회하는 방식이다.

## Core Pipeline: 로그가 실제로 쌓이는 경로

여기서 강의 화면 자막에 "쿠버네티스 버전 업데이트로 Containerd가 설치되었다"는 정정이 있었는데, 이 부분을 반영하면 로그 경로 설명도 같이 바뀌어야 한다.

![컨테이너 로그 경로, containerd 기준]({{ site.baseurl }}/assets/images/k8s-logging-monitoring/log_path_containerd.png)

- **예전(Docker)**: Docker의 로깅 드라이버가 `/etc/docker/daemon.json` 설정(컨테이너당 최대 파일 수·크기)에 따라 `/var/lib/docker/containers/<id>/<id>-json.log`에 로그를 쌓고, 여기서 `/var/log/pods/...` → `/var/log/containers/...`로 **2단계 심볼릭 링크**가 걸렸다
- **지금(containerd)**: kubelet이 CRI(Container Runtime Interface)에 로그 경로를 직접 지정해서, `/var/log/pods/<namespace>_<pod>_<uid>/<container>/<restart-count>.log`에 바로 기록된다. `/var/log/containers/...`로는 **1단계 링크**만 걸린다. 로그 회전(rotation)도 Docker daemon.json이 아니라 **kubelet이 직접** `containerLogMaxSize`(기본 10Mi), `containerLogMaxFiles`(기본 5개) 설정으로 관리한다

`kubectl logs`, `kubectl top`으로 조회하는 사용자 경험은 동일하고, 내부적으로 로그가 쌓이는 세부 경로만 달라진 셈이다.

Pod 안에는 `/dev/termination-log`라는 **Termination Message Path**도 기본으로 설정되어 있다. 앱 오류나 liveness probe 문제로 Pod가 재시작될 때, 죽기 전에 이 파일에 에러 로그를 남겨두면 로그 파일을 뒤지지 않고도 Pod 상세 조회(`kubectl describe pod`)만으로 재시작 원인을 바로 볼 수 있다.

---

## Node-level 로깅의 한계

지금까지 본 로그는 **Node-level 로깅**이다. Pod가 살아있는 동안만 유지되고, Pod가 삭제되면 관련 폴더와 링크도 같이 사라져서 로그를 더 이상 볼 수 없다. 이 문제를 해결하려면 **Cluster-level 로깅**이 필요하다. 쿠버네티스가 기능을 직접 제공하는 건 아니고, 여러 로깅 플러그인들이 공통적으로 쓰는 아키텍처 패턴을 제시해주는 정도다.

![Cluster-level 로깅 3가지 패턴]({{ site.baseurl }}/assets/images/k8s-logging-monitoring/cluster_logging_patterns.png)

- **① Node Logging Agent**: 가장 기본적인 패턴. 각 Node에 DaemonSet으로 Agent를 두고, Node에 쌓인 로그 경로를 읽어서 수집 서버로 전송한다. 앱 코드를 건드릴 필요가 없다
- **② Sidecar Streaming**: 한 컨테이너에서 로그 종류가 여러 개(예: access.log, app.log) 섞여 나올 때, 메인 컨테이너는 파일로만 저장하고 별도 Sidecar 컨테이너가 각 파일을 읽어서 stdout으로 출력해준다. 그러면 로그 파일이 컨테이너 단위로 깔끔하게 분리된다
- **③ Sidecar + Agent**: 로깅 Agent 자체를 Pod 안에 Sidecar로 넣는 방식. 앱 컨테이너가 stdout으로 안 뽑아도 Sidecar Agent가 수집해서 바로 수집 서버로 보낸다

---

## 대표적인 로깅/모니터링 플러그인 스택

대부분의 로깅·모니터링 플러그인은 **Agent(수집) → Aggregator(저장·분석) → Web UI(시각화)** 구조를 갖는다.

| 스택 | 구성 |
|---|---|
| **ELK** | Logstash(수집) + Elasticsearch(저장·분석) + Kibana(시각화) |
| **EFK** | Fluentd/Fluent Bit(수집, ELK보다 가벼움) + Elasticsearch + Kibana |
| **Prometheus + Grafana** | Prometheus(수집·저장) + Grafana(시각화) |
| **PLG → ALG** | Loki(저장) + Grafana(시각화)는 그대로지만, 수집 Agent가 바뀌었다 (바로 아래 참고) |

### PLG 스택의 Promtail, EOL 됐다

![Promtail EOL 안내]({{ site.baseurl }}/assets/images/k8s-logging-monitoring/promtail_eol.png)

**Promtail이 2026년 3월 2일부로 완전히 EOL**됐다. Grafana Labs가 통합 수집기인 **Grafana Alloy**로 개발 방향을 옮기면서, 기존 PLG(Promtail+Loki+Grafana) 스택은 더 이상 업데이트나 보안 패치를 받지 않는다.

기존 PLG 스택의 동작 방식(참고용)은 이랬다: DaemonSet으로 Promtail이 모든 Node에 설치되고, ConfigMap으로 로그 경로를 지정받아서 읽는다. StatefulSet으로 설치된 Loki에 Service를 통해 로그를 Push하고, Deployment로 설치된 Grafana가 Loki에 API 쿼리를 날려서 로그를 보여준다.

**지금 새로 구성한다면** Promtail 자리에 **Grafana Alloy**를 쓰면 된다. Alloy는 로그뿐 아니라 메트릭·트레이스까지 하나의 Agent로 통합 수집하고, OpenTelemetry와도 호환된다. Loki·Grafana는 그대로 쓰되, 수집 Agent만 교체하는 셈이다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Core Pipeline** | 쿠버네티스가 기본 제공하는 로깅·모니터링 경로 (cAdvisor, metrics-server, kubectl logs/top) |
| **Service Pipeline** | 플러그인을 설치해서 로깅·모니터링 기능을 강화하는 경로 |
| **containerLogMaxSize / containerLogMaxFiles** | containerd 환경에서 kubelet이 컨테이너 로그 회전을 직접 관리하는 설정값 |
| **Termination Message Path** | 기본적으로 `/dev/termination-log`에 설정된 경로. 여기 남긴 로그는 Pod 상세 조회로 바로 확인 가능 |
| **Node-level 로깅** | Pod가 살아있는 동안만 유지되는 로그. Pod 삭제 시 함께 사라짐 |
| **Cluster-level 로깅** | Pod가 죽어도 로그가 보존되도록 별도 아키텍처(Agent, Sidecar 등)로 수집·저장하는 방식 |
| **ELK / EFK** | Elasticsearch 기반 로깅 스택. Logstash 또는 Fluentd/Fluent Bit를 수집 Agent로 사용 |
| **Grafana Alloy** | Promtail을 대체하는 Grafana의 통합 관측 수집기. 로그·메트릭·트레이스를 한 Agent로 처리 |

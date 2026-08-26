---
layout: post
title: "Node Scheduling: NodeAffinity, PodAffinity, Taint/Toleration"
date: 2026-08-07
tags: [kubernetes, infra]
categories: [kubernetes]
---

Pod가 어느 Node에 배치될지를 제어하는 방법은 여러 가지다(NodeName, NodeSelector, NodeAffinity, PodAffinity/AntiAffinity, Taint/Toleration). 종류가 많아 헷갈리기 쉬워서 정리한다.

## 다섯 가지 방법, 언제 쓰는가

- **NodeName / NodeSelector / NodeAffinity**: Pod를 특정 Node에 배치되도록 "선택"하는 용도
- **PodAffinity / PodAntiAffinity**: 여러 Pod를 한 Node에 몰아 배치하거나, 반대로 서로 겹치지 않게 분산 배치하는 용도
- **Taint / Toleration**: 특정 Node에 아무 Pod나 못 들어오게 막는 용도 (다른 넷과 성격이 다르다 — 이건 Node 쪽에서 거는 제한이다)

---

## Node 선택하기: NodeName → NodeSelector → NodeAffinity

세 가지는 점점 더 유연해지는 순서로 이해하면 된다.

### NodeName: 가장 직접적이지만 실무에선 잘 안 씀

```yaml
spec:
  nodeName: node-1
```

스케줄러를 아예 거치지 않고 지정한 이름의 Node로 바로 배치된다. 명시적이라 좋아 보이지만, 실제 운영 환경에서는 Node가 추가/삭제되면서 이름이 계속 바뀔 수 있어서 잘 안 쓴다.

### NodeSelector: 라벨 기반의 간단한 매칭

```yaml
spec:
  nodeSelector:
    region: kr
```

Node에 붙은 라벨과 key-value가 정확히 일치해야 배치된다. 문제는 매칭되는 라벨을 가진 Node가 여러 개면 그중 자원이 많은 쪽으로 스케줄러가 알아서 고르지만, **매칭되는 Node가 하나도 없으면 Pod는 배치되지 못하고 계속 Pending 상태로 남는다** (에러로 죽는 게 아니라 대기 상태다).

### NodeAffinity: 조건을 더 세밀하게

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: region
                operator: In
                values: ["kr"]
```

NodeSelector보다 훨씬 유연하다. 예를 들어 key만 있으면 되고 value는 상관없다든가, 아예 조건에 안 맞아도 스케줄러가 알아서 적절한 곳에 배치하게 할 수도 있다.

**matchExpressions에서 쓸 수 있는 연산자는 6가지다**: `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`. `Gt`/`Lt`는 지정한 값보다 크거나 작은 걸 찾는 연산자로, 뒤에 나올 PodAffinity에는 없는 NodeAffinity만의 기능이다.

### required vs preferred

- **requiredDuringSchedulingIgnoredDuringExecution**: 조건에 맞는 Node가 없으면 절대 배치되지 않는다 (강제)
- **preferredDuringSchedulingIgnoredDuringExecution**: 조건에 맞는 Node를 선호할 뿐, 없어도 다른 곳에 배치될 수 있다 (선호)

`preferred`에는 `weight`(1~100)라는 값이 있는데, 이게 최종 배치를 결정짓는 핵심이다.

![weight가 자원보다 우선하는 예시]({{ site.baseurl }}/assets/images/k8s-node-scheduling/nodeaffinity_weight.png)

Node 1(CPU 자원 점수 50)과 Node 2(CPU 자원 점수 30)가 있을 때, Node 1이 자원은 더 많지만 Pod가 Node 2의 라벨(`kr`)에 훨씬 높은 weight(50)를 줬다면, `50(Node1 기본점수) + 10(weight)=60` vs `30(Node2 기본점수) + 50(weight)=80`으로 **Node 2가 최종적으로 선택된다.** 자원보다 weight가 최종 점수를 좌우할 수 있다는 뜻이다.

> `IgnoredDuringExecution`이라는 이름 그대로, 이미 배치된 Pod는 이후에 Node의 라벨이 바뀌어도 영향받지 않는다. 이 조건은 **스케줄링되는 그 순간에만** 적용된다.

---

## Pod끼리 묶거나 떨어뜨리기: PodAffinity / PodAntiAffinity

### PodAffinity: 같은 Node에 몰아 배치

예를 들어 웹 Pod와 서버 Pod가 같은 PersistentVolume(hostPath 방식)을 써야 해서, 반드시 같은 Node에 있어야 하는 상황이라면 PodAffinity를 쓴다.

```yaml
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: type
                operator: In
                values: ["web"]
          topologyKey: "team"
```

웹 Pod가 먼저 스케줄러에 의해 특정 Node에 배치되면, 서버 Pod는 이 설정으로 "`type: web` 라벨을 가진 Pod가 있는 Node"를 찾아서 같은 곳에 배치된다. 만약 조건에 맞는 Pod가 아직 없으면, 이 Pod는 조건이 만족될 때까지 계속 Pending으로 남는다.

### PodAntiAffinity: 서로 다른 Node로 분산

Master-Slave처럼 한쪽이 죽으면 다른 쪽이 백업해줘야 하는 관계라면, 같은 Node에 몰리면 안 된다. 이때는 PodAntiAffinity로 반대 조건을 준다.

```yaml
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: type
                operator: In
                values: ["master"]
          topologyKey: "team"
```

**`topologyKey`**는 "어느 범위의 Node들 안에서 찾을지"를 지정하는 값이다. 예를 들어 `topologyKey: team`이면, 같은 `team` 라벨 값을 가진 Node들끼리의 범위 안에서만 조건을 검사한다.

PodAffinity/AntiAffinity에도 NodeAffinity처럼 `required`/`preferred` 옵션을 똑같이 쓸 수 있다. 다만 **matchExpressions의 연산자는 `In`, `NotIn`, `Exists`, `DoesNotExist` 4가지만 가능하고, `Gt`/`Lt`는 지원하지 않는다.** (NodeAffinity와 헷갈리기 쉬운 부분이라 짚어둔다.)

---

## Node 쪽에서 막기: Taint와 Toleration

지금까지는 Pod가 Node를 선택하는 방법이었다면, Taint/Toleration은 **반대로 Node가 "아무나 들어오지 마"라고 거는 제한**이다.

GPU가 달린 특별한 Node가 있다고 하자. 운영자가 이 Node에 Taint를 걸면, 일반 Pod는 이 Node에 스케줄링되지 않는다. Pod 쪽에서 직접 이 Node를 지정해서 들어가려고 해도 막힌다. 이 Node를 실제로 써야 하는 Pod는 **Toleration**을 달아야 들어갈 수 있다.

```yaml
# Node에 Taint 설정 (kubectl 명령 예시)
# kubectl taint nodes node-1 hw=gpu:NoSchedule

# GPU가 필요한 Pod에는 Toleration을 줌
spec:
  tolerations:
    - key: "hw"
      operator: "Equal"
      value: "gpu"
      effect: "NoSchedule"
```

Toleration의 `operator`는 `Equal`과 `Exists` 두 가지만 가능하고, key/value/effect가 Taint 내용과 정확히 일치해야 한다. 하나라도 다르면 Toleration을 달았어도 못 들어간다.

**오해하기 쉬운 부분**: Toleration을 달았다고 해서 그 Node로 "찾아가는" 게 아니다. Toleration은 "이 Taint가 있는 Node에 들어갈 자격이 있다"는 조건일 뿐이고, 실제로 그 Node에 배치되게 하려면 **NodeSelector나 NodeAffinity를 별도로 함께 줘야 한다.**

### Taint의 3가지 Effect

![Taint의 3가지 Effect]({{ site.baseurl }}/assets/images/k8s-node-scheduling/taint_effects.png)

- **NoSchedule**: Toleration 없는 Pod는 아예 배치되지 않음. 이미 떠 있던 Pod에는 영향 없음
- **PreferNoSchedule**: 가급적 피하되, 다른 선택지가 없으면 배치될 수도 있음
- **NoExecute**: 배치도 막고, **이미 떠 있던 Pod까지 쫓아낸다.** Toleration이 없으면 즉시 삭제되고, `tolerationSeconds`를 지정해두면 그 시간 뒤에 삭제된다 (예: 60이면 60초 유예)

### 실제로 어디에 쓰이나

- **Control Plane 노드**(구 명칭 "마스터 노드")에는 기본적으로 `NoSchedule` Taint가 걸려 있어서, 일반 Pod가 여기 배치되지 않는다. (참고: 예전에는 이 Taint의 key가 `node-role.kubernetes.io/master`였는데, 쿠버네티스 1.20부터 부적절한 용어 정리 작업으로 `node-role.kubernetes.io/control-plane`으로 바뀌었다. 오래된 클러스터에는 여전히 옛 key가 남아있을 수 있다.)
- Node에 장애가 생기면, 쿠버네티스가 **자동으로 `NoExecute` Taint를 그 Node에 건다.** 그러면 ReplicaSet 같은 Controller가 관리하는 Pod는 다른 Node에 다시 만들어지면서 서비스가 유지된다. Node/Pod Affinity, NodeSelector, NoSchedule Taint는 전부 **최초 스케줄링 시점에만** 영향을 주는 조건이고, 이미 배치된 Pod를 쫓아낼 수 있는 건 **NoExecute뿐**이라는 걸 기억해두면 좋을 것 같다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **NodeName** | Node를 이름으로 직접 지정하는 방식. 스케줄러를 거치지 않음 |
| **NodeSelector** | Node의 라벨과 key-value가 정확히 일치해야 배치되는 방식 |
| **NodeAffinity** | matchExpressions로 더 세밀한 조건을 줄 수 있는 Node 선택 방식 |
| **requiredDuringSchedulingIgnoredDuringExecution** | 조건을 반드시 만족해야 배치되는 강제 옵션 |
| **preferredDuringSchedulingIgnoredDuringExecution** | 조건을 선호할 뿐 필수는 아닌 옵션. weight로 우선순위 조정 |
| **weight** | preferred 조건의 선호도 점수(1~100). 자원 점수와 합산되어 최종 배치를 결정 |
| **PodAffinity** | 특정 라벨을 가진 Pod와 같은 Node(또는 topology 범위)에 배치되도록 하는 설정 |
| **PodAntiAffinity** | 특정 라벨을 가진 Pod와 다른 Node(또는 topology 범위)에 배치되도록 하는 설정 |
| **topologyKey** | PodAffinity/AntiAffinity에서 "어느 범위의 Node까지 볼지"를 정하는 Node 라벨 키 |
| **Taint** | Node에 거는 제한. 이 태인트와 매칭되는 Toleration이 없는 Pod는 배치되지 않음 |
| **Toleration** | Pod가 특정 Taint를 감내할 수 있음을 표시하는 설정. Node를 찾아가는 기능은 아님 |
| **tolerationSeconds** | NoExecute Taint가 붙었을 때, Toleration이 있는 Pod를 얼마나 더 유지시켜줄지 지정하는 값 |

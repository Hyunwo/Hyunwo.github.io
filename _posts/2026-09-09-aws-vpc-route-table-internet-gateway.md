---
layout: post
title: "AWS VPC 라우팅: VPC Router, Route Table, Internet Gateway"
date: 2026-09-09
tags: [aws, vpc, route-table, internet-gateway, network, infra]
categories: [aws]
---

[지난 글](/2026/09/08/aws-vpc-subnet-basics/)에서 VPC와 Subnet의 기본 개념을 정리했다.

이번 글에서는 서브넷끼리, 그리고 서브넷과 인터넷 사이에 트래픽이 실제로 어떻게 흐르는지 — **VPC Router**, **Route Table**, **Internet Gateway**를 중심으로 살펴본다.

---

## Subnet은 기본적으로 독립적이다

지난 글에서 하나의 VPC(`10.0.0.0/16`) 안에 AZ별로 Subnet을 만들었다.

```text
VPC
10.0.0.0/16
│
├── AZ-a
│   └── Public Subnet A   10.0.1.0/24
│
└── AZ-c
    └── Public Subnet C   10.0.2.0/24
```

여기서 중요한 사실이 하나 있다. **아무 설정도 하지 않으면 이 두 Subnet은 서로 통신할 수 없다.** 즉, Subnet A에 있는 EC2가 Subnet C에 있는 EC2에게 트래픽을 보낼 방법이 없다.

이 문제를 해결해주는 것이 바로 **VPC Router**다.

---

## VPC Router란?

VPC Router는 VPC 안에 있는 **가상의 라우터**로, 모든 Subnet의 트래픽은 이 라우터를 거쳐 목적지로 향한다.

```text
Public Subnet A ──┐
                   ├── VPC Router ──→ 목적지
Public Subnet C ──┘
```

VPC Router의 특징은 다음과 같다.

- VPC 생성 시 **자동으로 생성**되며 별도 관리가 필요 없다
- 사용자가 직접 설정할 수 있는 부분이 거의 없다
- 사용자가 다룰 수 있는 유일한 설정 지점은 **Route Table**이다

즉, VPC Router 자체를 건드리는 게 아니라 "Route Table을 어떻게 구성하느냐"로 트래픽의 경로를 제어한다는 뜻이다.

---

## Route Table이란?

Route Table은 VPC Router에게 **"이 트래픽은 어디로 보내야 하는지"**를 알려주는 이정표다.

- VPC를 생성하면 기본 Route Table이 하나 자동으로 만들어진다
- 필요하면 추가로 여러 개를 만들 수 있다
- 구성 요소는 단 두 가지다

| 구성 요소 | 의미 |
|---|---|
| **Destination** | 트래픽이 향하는 목적지 IP 대역 (CIDR) |
| **Target** | 그 목적지로 트래픽을 보낼 대상 (리소스 ID로 표현) |

예를 들어 Route Table은 이런 모습이다.

| Destination | Target |
|---|---|
| `10.0.0.0/16` | `local` |
| `10.0.5.0/24` | `pcx-0123456789abcdef0` |
| `0.0.0.0/0` | `igw-0123456789abcdef0` |

`0.0.0.0/0`은 호스트 비트가 32비트 전부이기 때문에 **전 세계 모든 IP가 매칭**된다는 뜻이다.

---

## 라우트 매칭 규칙: 가장 구체적인 것이 이긴다

여기서 헷갈리기 쉬운 부분이 나온다. 위 Route Table을 보면 대부분의 IP는 `10.0.0.0/16`에도 매칭되고, 동시에 `0.0.0.0/0`에도 매칭된다. 그럼 어디로 보내야 할까?

> **매칭되는 항목이 여러 개라면, Prefix 숫자가 가장 큰(=가장 구체적인) 항목으로 보낸다.**

이를 **최장 일치 규칙(Longest Prefix Match)**이라 부른다.

몇 가지 예시로 확인해보자. (위 Route Table 기준)

**① `10.0.1.231`이 들어온 경우**
- `10.0.0.0/16`에도 매칭, `0.0.0.0/0`에도 매칭
- 더 구체적인 건 `/16` → **`local`로 전달** (VPC 내부 통신)

**② `10.0.5.18`이 들어온 경우**
- `10.0.0.0/16`에도 매칭, `10.0.5.0/24`에도 매칭, `0.0.0.0/0`에도 매칭
- 가장 구체적인 건 `/24` → **`pcx-...` (VPC Peering)로 전달**

**③ `8.8.8.8`이 들어온 경우**
- `10.0.0.0/16`에는 매칭되지 않음
- `0.0.0.0/0`에는 매칭됨 → **`igw-...` (Internet Gateway)로 전달**

**④ Route Table에 아예 매칭되는 항목이 없는 경우**
- 트래픽은 그대로 **드롭**된다. 갈 곳이 없기 때문이다

이 마지막 케이스가 바로 Private Subnet에서 벌어지는 일이다.

---

## Public Subnet vs Private Subnet, 다시 정확히 보기

지난 글에서는 두 Subnet의 역할을 간단히 정리했는데, 실제로 둘을 가르는 기준은 **"Route Table에 Internet Gateway로 가는 경로(`0.0.0.0/0 → igw-...`)가 있는가"** 하나뿐이다.

| 구분 | Public Subnet | Private Subnet |
|---|---|---|
| Internet Gateway 경로 | 있음 | 없음 |
| 퍼블릭 IP 할당 | 의미 있음 | 할당해도 쓸모없음 |
| 외부 → 내부 접근 | 가능 | 불가능 |
| 내부 → 외부 접근 | 가능 | 불가능 (경로 없음) |
| 주로 배치하는 리소스 | 웹서버, 애플리케이션 서버 | 데이터베이스, 로직 서버 |

퍼블릭 IP는 사실 Private Subnet에 있는 인스턴스에도 "할당 자체"는 가능하다. 다만 인터넷으로 나가는 경로가 없으니 아무 쓸모가 없을 뿐이다. 그리고 Private Subnet은 외부에서 들어오는 경로도, 내부에서 나가는 경로도 없기 때문에 보안 사고에 훨씬 안전한 위치가 된다. 데이터베이스나 내부 로직 서버처럼 외부에 직접 노출될 필요가 없는 리소스를 여기에 두는 이유다.

---

## Internet Gateway란?

Internet Gateway(IGW)는 **VPC가 외부 인터넷과 통신할 수 있도록 경로를 만들어주는 리소스**다.

주요 특징:

- 기본적으로 **확장성과 고가용성이 확보**되어 있어 여러 개를 만들 필요가 없다
- **IPv4, IPv6를 모두 지원**한다
- IPv4의 경우, 퍼블릭 IP와 프라이빗 IP를 1:1로 매핑해주는 **NAT 역할도 함께 수행**한다
- Route Table에서 경로를 설정해야 실제로 사용할 수 있다
- **무료**다 (데이터 전송 비용은 별도)

즉, IGW를 만들었다고 해서 자동으로 모든 Subnet이 인터넷에 연결되는 게 아니라, **각 Subnet의 Route Table에 IGW로 가는 경로를 명시해야만** 그 Subnet이 Public Subnet이 된다.

### 트래픽 흐름 예시

Public Subnet의 EC2가 외부 IP(`8.8.8.8`)로 요청을 보내는 상황:

```text
EC2 (Public Subnet)
     │
     ▼
Route Table  ── 0.0.0.0/0 매칭 → igw-xxxx
     │
     ▼
Internet Gateway
     │
     ▼
Internet
```

같은 경로로 외부에서 들어오는 응답 트래픽도 IGW를 거쳐 EC2까지 도달한다.

반면 Private Subnet의 EC2가 같은 요청을 시도하면:

```text
EC2 (Private Subnet)
     │
     ▼
Route Table  ── 매칭되는 항목 없음
     │
     ▼
     ✕ (드롭)
```

Route Table에 매칭되는 항목이 없으므로 트래픽은 아예 밖으로 나가지 못한다. **IGW가 VPC에 존재하더라도, 경로가 뚫려 있지 않은 Subnet은 이를 사용할 수 없다.**

---

## EC2 말고 다른 서비스도 Subnet을 쓴다: Amazon EFS 사례

지금까지는 EC2 중심으로 설명했지만, Subnet은 EC2 전용 개념이 아니다.

**Amazon EFS**가 대표적인 예다. EFS는 각 Subnet마다 하나씩 **Mount Target**을 생성한다. 그러면 각 Subnet에 있는 EC2는 같은 Subnet(또는 AZ) 안에 있는 자신의 Mount Target을 통해 EFS에 접속한다.

```text
VPC
├── Subnet A ── EC2 A ──→ Mount Target A ──┐
│                                          ├── EFS
└── Subnet C ── EC2 C ──→ Mount Target C ──┘
```

이처럼 EFS는 사용자가 원하는 Subnet에 Mount Target을 배치할 수 있다는 점에서, Subnet이 EC2 외의 서비스에서도 네트워크 경계로 쓰인다는 걸 보여주는 사례다.

---

## 기본 VPC vs 커스텀 VPC

### 기본 VPC (Default VPC)

- AWS 계정 생성 시 **리전마다 자동으로 하나씩** 만들어진다
- 각 AZ마다 Subnet이 이미 생성되어 있다
- **모든 Subnet이 Public Subnet**이다 (IGW가 이미 연결되어 있음)
- 그래서 EC2를 처음 배울 때 VPC나 Subnet을 별도로 설정한 적이 없어도 인터넷에 연결된 인스턴스를 바로 만들 수 있었던 것이다
- 여러 AWS 서비스가 기본 VPC를 사용하기 때문에, **삭제하면 다른 서비스에 제약이 생길 수 있어 되도록 삭제하지 않는 것을 권장**한다

### 커스텀 VPC (Custom VPC)

- 사용자가 직접 생성하는 VPC
- 기본적으로 **인터넷에 연결되어 있지 않다** (IGW가 없음)
- IGW를 직접 만들고 연결하기 전까지는 Public Subnet 자체를 만들 수 없다
- 즉, 커스텀 VPC를 생성한 뒤 아무 조치도 하지 않으면 EC2를 만들어도 인터넷 연결이 되지 않는다

---

## 핵심 개념 정리

| 개념 | 설명 |
|---|---|
| **VPC Router** | VPC 생성 시 자동 생성되는 가상 라우터. 모든 Subnet 트래픽이 거쳐감 |
| **Route Table** | Destination(목적지 CIDR)과 Target(전달 대상)으로 구성된 경로표 |
| **최장 일치 규칙** | 여러 항목이 매칭되면 Prefix 숫자가 가장 큰(구체적인) 항목이 우선 |
| **Internet Gateway** | VPC와 인터넷을 연결하는 무료 리소스. IPv4/IPv6 지원, 자체 NAT 수행 |
| **Public Subnet 판별 기준** | Route Table에 `0.0.0.0/0 → igw-...` 경로가 있는가 |
| **기본 VPC** | 리전마다 자동 생성, 모든 Subnet이 Public |
| **커스텀 VPC** | 직접 생성, IGW 연결 전까지 Public Subnet 생성 불가 |

---

## 🎯 반드시 기억할 내용

### 1. Subnet은 기본적으로 독립적이다
> **VPC Router와 Route Table 없이는 Subnet끼리도 통신할 수 없다.**

### 2. Route Table 매칭
> **여러 경로가 매칭되면 가장 구체적인(prefix 숫자가 큰) 경로가 우선한다.**

### 3. Public Subnet의 진짜 정의
> **퍼블릭 IP를 가진 인스턴스가 있어서가 아니라, Route Table에 Internet Gateway로 가는 경로가 있기 때문에 Public Subnet이다.**

### 4. Internet Gateway
> **VPC와 인터넷을 연결하는 무료·고가용성 리소스이며, Route Table에 경로를 명시해야 실제로 작동한다.**

---

## 한 문장으로 정리

> **Subnet은 기본적으로 서로 격리되어 있으며, VPC Router가 Route Table을 기준으로 트래픽을 중계한다. Route Table은 최장 일치 규칙으로 목적지를 결정하고, Public Subnet은 이 Route Table에 Internet Gateway로 가는 경로가 있는 Subnet을 의미한다.**

다음 글에서는 Private Subnet이 외부로 나갈 수 있게 해주는 **NAT Gateway**를 다룬다.

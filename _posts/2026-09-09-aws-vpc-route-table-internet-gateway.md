---
layout: post
title: "AWS VPC 라우팅: VPC Router, Route Table, Internet Gateway"
date: 2026-09-09
tags: [aws, vpc, route-table, internet-gateway, network, infra]
categories: [aws]
---

[지난 글](/2026/09/08/aws-vpc-subnet-basics/)에서 VPC와 Subnet의 기본 개념을 정리했다. 이번 글에서는 서브넷끼리, 그리고 서브넷과 인터넷 사이에 트래픽이 실제로 어떻게 흐르는지 — VPC Router, Route Table, Internet Gateway를 중심으로 살펴본다.

## Subnet은 독립적이다: VPC Router가 필요한 이유

지난 글에서 하나의 VPC(`10.0.0.0/16`) 안에 AZ별로 Subnet을 두 개 만들었다. 그런데 아무 설정도 하지 않으면 이 두 Subnet은 서로 통신할 수 없다. Subnet A에 있는 EC2가 Subnet C에 있는 EC2에게 트래픽을 보낼 방법이 없다는 뜻이다.

이 문제를 해결해주는 게 **VPC Router**다. VPC 안의 가상 라우터로, 모든 Subnet의 트래픽은 이 라우터를 거쳐 목적지로 향한다. VPC 생성 시 자동으로 만들어지고 별도 관리가 필요 없는데, 대신 사용자가 직접 다룰 수 있는 설정 지점도 거의 없다. 실질적으로 사용자가 트래픽 경로를 제어하는 유일한 방법은 **Route Table**을 구성하는 것이다.

---

## Route Table: Destination과 Target으로 이루어진 이정표

Route Table은 VPC Router에게 "이 트래픽은 어디로 보내야 하는지"를 알려주는 이정표다. VPC를 생성하면 기본 Route Table이 하나 자동으로 만들어지고, 필요하면 추가로 만들 수도 있다. 구성 요소는 단 두 가지, Destination(목적지 CIDR)과 Target(전달 대상)이다.

| Destination | Target |
|---|---|
| `10.0.0.0/16` | `local` |
| `10.0.5.0/24` | `pcx-0123456789abcdef0` |
| `0.0.0.0/0` | `igw-0123456789abcdef0` |

`0.0.0.0/0`은 호스트 비트가 32비트 전부라 전 세계 모든 IP가 매칭된다는 뜻이다. 문제는 위 표만 보면 대부분의 IP가 `10.0.0.0/16`에도, `0.0.0.0/0`에도 동시에 매칭된다는 점이다. 이때 AWS는 **최장 일치 규칙(Longest Prefix Match)**을 따른다. 여러 항목이 매칭되면 Prefix 숫자가 가장 큰(=가장 구체적인) 항목이 우선한다.

위 Route Table 기준으로 실제 IP가 들어왔을 때 어디로 가는지 정리하면 이렇다.

| 들어온 IP | 매칭되는 Destination | 최종 Target | 이유 |
|---|---|---|---|
| `10.0.1.231` | `/16`, `/0` | `local` | `/16`이 더 구체적 |
| `10.0.5.18` | `/16`, `/24`, `/0` | `pcx-...` (VPC Peering) | `/24`가 가장 구체적 |
| `8.8.8.8` | `/0`만 | `igw-...` (Internet Gateway) | `/16`엔 매칭 안 됨 |
| 그 외 매칭 없음 | 없음 | — | 트래픽 드롭 |

마지막 케이스, 즉 매칭되는 항목이 아예 없어서 트래픽이 드롭되는 경우가 바로 Private Subnet에서 벌어지는 일이다.

---

## Public Subnet과 Private Subnet: 진짜 판별 기준

지난 글에서는 두 Subnet의 역할을 간단히 정리했는데, 실제로 둘을 가르는 기준은 하나뿐이다. Route Table에 Internet Gateway로 가는 경로(`0.0.0.0/0 → igw-...`)가 있는가다.

| 구분 | Public Subnet | Private Subnet |
|---|---|---|
| Internet Gateway 경로 | 있음 | 없음 |
| 퍼블릭 IP 할당 | 의미 있음 | 할당해도 쓸모없음 |
| 외부 → 내부 접근 | 가능 | 불가능 |
| 내부 → 외부 접근 | 가능 | 불가능 (경로 없음) |
| 주로 배치하는 리소스 | 웹서버, 애플리케이션 서버 | 데이터베이스, 로직 서버 |

퍼블릭 IP는 사실 Private Subnet에 있는 인스턴스에도 할당 자체는 가능하다. 다만 인터넷으로 나가는 경로가 없으니 쓸모가 없을 뿐이다. Private Subnet은 외부에서 들어오는 경로도, 내부에서 나가는 경로도 없기 때문에 보안 사고에 훨씬 안전한 위치가 되고, 그래서 데이터베이스나 내부 로직 서버처럼 외부에 직접 노출될 필요가 없는 리소스를 여기에 둔다.

---

## Internet Gateway: 특징과 트래픽 흐름

Internet Gateway(IGW)는 VPC가 외부 인터넷과 통신할 수 있도록 경로를 만들어주는 리소스다. 기본적으로 확장성과 고가용성이 확보되어 있어 여러 개를 만들 필요가 없고, IPv4와 IPv6를 모두 지원한다. IPv4의 경우 퍼블릭 IP와 프라이빗 IP를 1:1로 매핑해주는 NAT 역할도 함께 수행하며, 사용 자체는 무료다(데이터 전송 비용은 별도).

다만 IGW를 만들었다고 자동으로 모든 Subnet이 인터넷에 연결되는 건 아니다. 각 Subnet의 Route Table에 IGW로 가는 경로를 명시해야만 그 Subnet이 Public Subnet이 된다. Public Subnet의 EC2가 외부 IP로 요청을 보내면 Route Table에서 `0.0.0.0/0` 매칭을 거쳐 IGW로, 다시 인터넷으로 나간다. 같은 경로로 외부에서 들어오는 응답도 IGW를 거쳐 EC2까지 도달한다.

반면 Private Subnet의 EC2가 같은 요청을 시도하면 Route Table에 매칭되는 항목이 없으므로 트래픽은 아예 밖으로 나가지 못한다. IGW가 VPC에 존재하더라도, 경로가 뚫려 있지 않은 Subnet은 이를 사용할 수 없다는 뜻이다.

---

## EC2 말고 다른 서비스도 Subnet을 쓴다: Amazon EFS 사례

지금까지는 EC2 중심으로 설명했지만, Subnet은 EC2 전용 개념이 아니다. **Amazon EFS**가 대표적인 예인데, EFS는 각 Subnet마다 하나씩 Mount Target을 생성한다. 각 Subnet에 있는 EC2는 같은 Subnet(또는 AZ) 안에 있는 자신의 Mount Target을 통해 EFS에 접속하는 식이다. 사용자가 원하는 Subnet에 Mount Target을 배치할 수 있다는 점에서, Subnet이 EC2 외의 서비스에서도 네트워크 경계로 쓰인다는 걸 보여주는 사례다.

---

## 기본 VPC와 커스텀 VPC

**기본 VPC(Default VPC)**는 AWS 계정 생성 시 리전마다 자동으로 하나씩 만들어진다. 각 AZ마다 Subnet이 이미 생성되어 있고, 모든 Subnet이 Public Subnet이다(IGW가 이미 연결되어 있음). EC2를 처음 배울 때 VPC나 Subnet을 별도로 설정한 적이 없어도 인터넷에 연결된 인스턴스를 바로 만들 수 있었던 이유가 이것이다. 여러 AWS 서비스가 기본 VPC를 사용하기 때문에, 삭제하면 다른 서비스에 제약이 생길 수 있어 되도록 삭제하지 않는 것을 권장한다.

**커스텀 VPC(Custom VPC)**는 사용자가 직접 생성하는 VPC로, 기본적으로 인터넷에 연결되어 있지 않다(IGW가 없음). IGW를 직접 만들고 연결하기 전까지는 Public Subnet 자체를 만들 수 없다. 즉 커스텀 VPC를 생성한 뒤 아무 조치도 하지 않으면 EC2를 만들어도 인터넷 연결이 되지 않는다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **VPC Router** | VPC 생성 시 자동 생성되는 가상 라우터. 모든 Subnet 트래픽이 거쳐감 |
| **Route Table** | Destination(목적지 CIDR)과 Target(전달 대상)으로 구성된 경로표 |
| **최장 일치 규칙** | 여러 경로가 매칭되면 Prefix 숫자가 가장 큰(구체적인) 경로가 우선한다는 규칙 |
| **Internet Gateway** | VPC와 인터넷을 연결하는 무료 리소스. IPv4/IPv6 지원, 자체 NAT 수행 |
| **Public Subnet 판별 기준** | Route Table에 `0.0.0.0/0 → igw-...` 경로가 있는가 |
| **기본 VPC** | 리전마다 자동 생성되며 모든 Subnet이 Public |
| **커스텀 VPC** | 직접 생성하며 IGW 연결 전까지 Public Subnet 생성 불가 |

다음 글에서는 Private Subnet이 외부로 나갈 수 있게 해주는 NAT Gateway를 다룬다.

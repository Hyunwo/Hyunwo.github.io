---
layout: post
title: "AWS VPC와 Subnet 기본 개념 정리"
date: 2026-09-08
tags: [aws, vpc, subnet, network, infra]
categories: [aws]
---

AWS 네트워크의 기본이 되는 VPC(Virtual Private Cloud)와 Subnet을 정리한다. VPC의 기본 개념부터 VPC와 Subnet의 관계, CIDR을 이용한 IP 대역 분할, AWS Subnet에서 예약되는 5개의 IP까지 다룬다.

## VPC: AWS에서 빌려 쓰는 가상의 데이터센터

VPC는 Virtual Private Cloud의 약자로, AWS에서 제공하는 사용자 전용 가상 네트워크다. AWS 클라우드의 다른 가상 네트워크와 논리적으로 분리되어 있으며, 그 안에서 EC2, RDS 같은 AWS 리소스를 실행한다. IP 주소 대역 설정부터 Subnet 생성, Route Table 구성, Internet Gateway 연결, Security Group·NACL 설정, 인터넷 접근 여부 제어까지 직접 구성할 수 있다는 게 핵심이다. 즉 AWS에서 서버를 쓰더라도 단순히 서버 한 대를 빌리는 게 아니라, 원하는 형태의 사설 네트워크를 구성하고 그 안에 리소스를 배치하는 구조다.

VPC는 몇 가지 성격을 갖는다. 다른 AWS 사용자의 VPC와는 논리적으로 완전히 분리되어 있고, 하나의 VPC는 하나의 Region에만 속한다(여러 Region에 걸쳐 존재하지 않는다). EC2, RDS 같은 리소스는 실제로 이 VPC 내부 네트워크에서 실행되는데, EC2를 만들 때 VPC를 따로 의식하지 않았더라도 마찬가지다.

---

## AWS 서비스와 VPC: 퍼블릭 서비스는 인터넷을 거친다

S3, DynamoDB, CloudWatch처럼 AWS가 제공하는 서비스 중 상당수는 기본적으로 퍼블릭 인터넷을 통해 접근하는 서비스다. 반면 VPC는 퍼블릭 인터넷과 논리적으로 분리된 프라이빗 네트워크이기 때문에, VPC 내부 리소스가 별도 설정 없이 이런 퍼블릭 AWS 서비스와 통신하면 결국 인터넷을 거쳐 통신하는 구조가 된다. **VPC Endpoint**를 사용하면 인터넷을 거치지 않고 VPC에서 AWS 서비스로 직접 연결하는 구성도 가능하다.

---

## VPC의 주요 구성 요소

앞으로 VPC를 구성할 때 다음 요소들을 계속 쓰게 된다.

| 구성 요소 | 역할 |
|---|---|
| **VPC** | 전체적인 가상 네트워크 |
| **Subnet** | VPC의 IP 대역을 더 작은 네트워크로 분할 |
| **Route Table** | 네트워크 트래픽의 이동 경로 결정 |
| **Internet Gateway** | VPC와 인터넷 간 통신 |
| **Security Group** | 인스턴스 수준의 보안 규칙 |
| **NACL** | Subnet 수준의 보안 규칙 |
| **EC2** | 실제 서버 |
| **NAT Gateway** | Private Subnet의 리소스가 외부로 나갈 수 있도록 지원 |
| **Bastion Host** | Private 환경의 서버에 접근하기 위한 중간 서버 |
| **VPC Endpoint** | 인터넷을 거치지 않고 AWS 서비스에 연결 |

---

## VPC와 Subnet의 IP 대역: CIDR

VPC를 생성할 때 CIDR Block을 지정한다. 이번 글에서 쓰는 VPC는 `10.0.0.0/16`인데, `/16`은 32비트 IPv4 주소 중 앞 16비트를 네트워크 비트로 쓴다는 의미다. 호스트 비트가 16비트 남으므로 전체 IP 개수는 2^16 = 65,536개다.

Subnet은 VPC의 하위 네트워크로, VPC에 할당된 큰 IP 대역을 더 작은 단위로 나눈 것이다. 예를 들어 `10.0.0.0/16` VPC 안에 `10.0.1.0/24`, `10.0.2.0/24` 같은 Public Subnet과 `10.0.3.0/24`, `10.0.4.0/24` 같은 Private Subnet을 둘 수 있다. 기본 관계는 VPC → Subnet → AWS Resource(EC2 등) 순이다.

CIDR의 Host Bit 수에 따라 전체 IP 개수가 정해진다(`2^(Host Bit)`). `/24`면 Host Bit가 8개라 256개, `/28`이면 Host Bit가 4개라 16개가 되는 식이다.

| CIDR | Host Bit | 전체 IP |
|---|---:|---:|
| `/16` | 16 | 65,536 |
| `/24` | 8 | 256 |
| `/25` | 7 | 128 |
| `/26` | 6 | 64 |
| `/27` | 5 | 32 |
| `/28` | 4 | 16 |

CIDR 숫자가 커질수록 Host Bit가 줄어들기 때문에, 오히려 사용 가능한 IP 대역은 작아진다.

---

## Subnet은 하나의 AZ에만 존재한다

AWS에서 중요한 규칙이 하나 있다. 하나의 Subnet은 하나의 Availability Zone(AZ)에만 존재한다. 서울 Region에 AZ가 여러 개 있다면, AZ-a에 Public/Private Subnet을 하나씩, AZ-c에도 또 하나씩 따로 만들어야 하는 식이다. 하나의 Subnet이 두 AZ에 동시에 걸쳐 존재할 수는 없기 때문에, 여러 AZ에 걸친 고가용성 환경을 구성하려면 AZ마다 별도로 Subnet을 만들어야 한다.

---

## AWS Subnet에서 예약되는 5개의 IP

AWS는 IPv4 Subnet을 쓸 때 일반적인 계산과 다르게 각 Subnet에서 IP 5개를 예약해둔다. 그래서 사용 가능한 IP는 전체 IP 개수에서 5를 뺀 값이다. `10.0.0.0/24`라면 전체 256개 중 251개를 쓸 수 있다.

어떤 IP가 예약되는지 구체적으로 보면 이렇다.

| IP | 용도 |
|---|---|
| `10.0.0.0` | 네트워크 주소 |
| `10.0.0.1` | VPC Router |
| `10.0.0.2` | AWS DNS 서버 |
| `10.0.0.3` | 향후 사용을 위해 예약 |
| `10.0.0.255` | 네트워크 브로드캐스트 주소 (AWS는 VPC 내 브로드캐스트를 지원하지 않지만, 이 주소는 관례상 예약해둔다) |

따라서 실제 사용 가능한 범위는 `10.0.0.4 ~ 10.0.0.254`, 총 251개다.

AWS IPv4 Subnet에서 만들 수 있는 가장 작은 CIDR은 `/28`이다. Host Bit가 4개라 전체 IP는 2^4 = 16개인데, 여기서도 5개가 예약되므로 실제 사용 가능한 IP는 11개다. 정리하면 AWS VPC의 IPv4 CIDR은 `/16`(가장 큰 범위)부터 `/28`(가장 작은 범위)까지 쓸 수 있다.

VPC와 Subnet은 IPv6도 지원하지만, 주소 체계와 계산 방식이 IPv4와 달라서 별도로 정리할 필요가 있다. 이번 글에서는 IPv4 CIDR과 Subnet IP 계산을 중심으로 다뤘다.

---

## VPC와 Subnet 전체 구조

지금까지 배운 내용을 하나로 연결하면, Region 안에 VPC(`10.0.0.0/16`)가 있고, 그 안에 AZ별로 Public/Private Subnet이 하나씩 배치되는 구조다. AZ-a에는 Public Subnet(`10.0.1.0/24`)에 EC2를, Private Subnet(`10.0.2.0/24`)에 RDS를 두는 식이고, AZ-c도 동일한 패턴을 반복한다.

여기에 인터넷 연결까지 더하면 EC2 → Route Table → Internet Gateway → Internet 순으로 트래픽이 흐르고, Private Subnet에서 외부로 나가야 하는 경우에는 보통 NAT Gateway를 거쳐 Internet Gateway로 이어진다. Route Table, Internet Gateway, NAT Gateway는 다음 글에서 자세히 다룬다.

---

## 용어 정리

| 개념 | 설명 |
|---|---|
| **VPC** | AWS에서 사용하는 논리적으로 격리된 가상 네트워크 |
| **Region** | VPC가 속하는 AWS의 지리적 영역 |
| **Subnet** | VPC의 IP 대역을 더 작은 네트워크로 나눈 것. 하나의 AZ에만 존재 |
| **AZ** | Subnet이 실제로 속하는 가용 영역 |
| **CIDR** | VPC/Subnet의 IP 주소 범위를 표현하는 방식 |
| **Public Subnet** | 인터넷과 연결되는 형태로 구성할 수 있는 Subnet |
| **Private Subnet** | 외부 인터넷에서 직접 접근할 수 없도록 구성하는 Subnet |
| **Internet Gateway** | VPC와 인터넷 사이의 연결 지점 |
| **NAT Gateway** | Private Subnet의 리소스가 외부로 나갈 수 있도록 지원 |
| **Route Table** | 네트워크 트래픽의 목적지와 경로를 결정 |
| **Security Group** | AWS 리소스 수준의 보안 규칙 |
| **NACL** | Subnet 수준의 보안 규칙 |
| **VPC Endpoint** | 인터넷을 거치지 않고 AWS 서비스와 통신할 수 있도록 하는 연결 방식 |

AWS Subnet의 사용 가능 IP는 `2^(Host Bit) - 5`로 계산한다는 것만 기억해두면, 이후 CIDR 설계할 때 계속 쓰인다. 다음 글에서는 이 VPC 안에서 트래픽이 실제로 어떻게 오가는지 — VPC Router, Route Table, Internet Gateway를 다룬다.

---
layout: post
title: "AWS VPC와 Subnet 기본 개념 정리"
date: 2026-09-08
tags: [aws, vpc, subnet, network, infra]
categories: [aws]
---

AWS 네트워크의 기본이 되는 **VPC(Virtual Private Cloud)**와 **Subnet**을 정리한다.

이번 글에서는 VPC의 기본 개념부터 VPC와 Subnet의 관계, CIDR을 이용한 IP 대역 분할, AWS Subnet에서 예약되는 5개의 IP까지 살펴본다.

---

## VPC란?

VPC는 **Virtual Private Cloud**의 약자로, AWS에서 제공하는 **사용자 전용 가상 네트워크**다.

쉽게 말하면:

> **VPC = AWS에서 빌려 사용하는 가상의 데이터센터**

VPC는 AWS 클라우드의 다른 가상 네트워크와 논리적으로 분리되어 있으며, 그 안에서 EC2, RDS 등의 AWS 리소스를 실행할 수 있다.

VPC를 이용하면 다음과 같은 네트워크 환경을 직접 구성할 수 있다.

- IP 주소 대역 설정
- Subnet 생성
- Route Table 구성
- Internet Gateway 연결
- Security Group 설정
- NACL 설정
- 인터넷 접근 여부 제어
- Private 환경 구성

즉, AWS에서 서버를 사용하더라도 단순히 서버 한 대를 빌리는 것이 아니라 **내가 원하는 형태의 사설 네트워크를 구성하고 그 안에 AWS 리소스를 배치할 수 있다.**

---

## AWS 서비스와 VPC

AWS에는 S3, DynamoDB, CloudWatch 등 다양한 서비스가 존재한다.

이러한 AWS 서비스 중 상당수는 기본적으로 퍼블릭 인터넷을 통해 접근할 수 있는 서비스다.

반면 VPC는 **퍼블릭 인터넷과 논리적으로 분리된 프라이빗 네트워크**다.

예를 들어 다음과 같은 구조를 생각할 수 있다.

```text
                    Internet
                       │
          ┌────────────┼────────────┐
          │            │            │
        S3         DynamoDB     CloudWatch
      (Public)      (Public)      (Public)

                       │
                  Internet
                       │
              Internet Gateway
                       │
               ┌───────┴───────┐
               │      VPC      │
               │ 10.0.0.0/16   │
               │               │
               │     EC2       │
               │     RDS       │
               └───────────────┘
```

VPC 내부의 리소스가 별도의 설정 없이 퍼블릭 AWS 서비스와 통신할 경우, 인터넷을 통해 통신하는 구조가 될 수 있다.

다만 **VPC Endpoint** 등을 사용하면 인터넷을 거치지 않고 VPC에서 AWS 서비스로 직접 연결하는 구성도 가능하다.

---

## VPC의 특징

### ① 논리적으로 격리된 네트워크

VPC는 다른 AWS 사용자의 VPC와 논리적으로 분리되어 있다.

```text
AWS Cloud

├── 사용자 A
│   └── VPC
│
├── 사용자 B
│   └── VPC
│
└── 사용자 C
    └── VPC
```

따라서 VPC는 사용자가 독립적으로 네트워크를 구성할 수 있는 기본적인 단위다.

### ② Region 단위

VPC는 **하나의 AWS Region에 속한다.**

```text
Seoul Region
└── VPC

Tokyo Region
└── VPC
```

하나의 VPC가 여러 Region에 걸쳐 존재하는 구조는 아니다.

### ③ AWS 리소스가 실행되는 네트워크

EC2, RDS 등의 AWS 리소스는 VPC와 연관되어 동작한다.

특히 EC2를 생성할 때 VPC를 별도로 의식하지 않았더라도, 실제로는 **VPC 내부의 네트워크에서 실행되고 있는 것**이다.

---

## VPC의 주요 구성 요소

VPC를 구성할 때 앞으로 다음과 같은 요소들을 사용하게 된다.

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

## VPC의 IP 대역

VPC를 생성할 때 CIDR Block을 지정한다.

이번 강의에서는 다음과 같은 VPC를 사용한다.

```text
10.0.0.0/16
```

`/16`은 전체 32비트 IPv4 주소 중 앞의 16비트를 네트워크 비트로 사용한다는 의미다.

```text
10.0.0.0/16

Network Bit        Host Bit
<------16------> <----16---->
```

따라서 호스트 비트가 16비트이므로 전체 IP 개수는 다음과 같다.

```text
2^16 = 65,536
```

즉, `10.0.0.0/16` VPC는 총 65,536개의 IPv4 주소를 포함하는 IP 대역이다.

---

## Subnet이란?

Subnet은 **VPC의 하위 네트워크**다.

VPC에 할당된 큰 IP 대역을 더 작은 단위로 나누어 사용하는 개념이다.

예를 들어 VPC가:

```text
10.0.0.0/16
```

이라면 내부를 여러 개의 Subnet으로 나눌 수 있다.

```text
VPC
10.0.0.0/16
│
├── Public Subnet
│   └── 10.0.1.0/24
│
├── Public Subnet
│   └── 10.0.2.0/24
│
├── Private Subnet
│   └── 10.0.3.0/24
│
└── Private Subnet
    └── 10.0.4.0/24
```

따라서 기본적인 관계는 다음과 같다.

> **VPC → Subnet → AWS Resource(EC2 등)**

---

## ⭐ Subnet은 하나의 AZ에만 존재한다

AWS에서 매우 중요한 개념이다.

> **하나의 Subnet은 하나의 Availability Zone(AZ)에만 존재한다.**

예를 들어 서울 Region에 여러 AZ가 있다면 다음과 같이 구성할 수 있다.

```text
Seoul Region
│
├── AZ-a
│   ├── Public Subnet A
│   └── Private Subnet A
│
└── AZ-c
    ├── Public Subnet C
    └── Private Subnet C
```

하나의 Subnet이 AZ-a와 AZ-c에 동시에 걸쳐 존재할 수는 없다.

따라서 여러 AZ에 걸쳐 고가용성 환경을 구성하려면 **각 AZ에 별도의 Subnet을 생성**해야 한다.

### 핵심 암기

> **하나의 Subnet = 하나의 AZ**

---

## Subnet의 CIDR Block

Subnet 역시 CIDR Block을 사용하여 IP 범위를 지정한다.

예:

```text
10.0.1.0/24
```

`/24`이므로:

```text
Network Bit = 24bit
Host Bit    = 8bit
```

따라서 전체 IP 개수는:

```text
2^8 = 256개
```

이다.

---

## CIDR Prefix와 IP 개수

IPv4는 총 32비트이므로 Host Bit의 개수에 따라 IP 개수가 결정된다.

```text
IP 개수 = 2^(Host Bit)
```

예를 들어:

| CIDR | Host Bit | 전체 IP |
|---|---:|---:|
| `/16` | 16 | 65,536 |
| `/24` | 8 | 256 |
| `/25` | 7 | 128 |
| `/26` | 6 | 64 |
| `/27` | 5 | 32 |
| `/28` | 4 | 16 |

CIDR의 숫자가 커질수록 Host Bit가 줄어들기 때문에 **사용할 수 있는 IP 대역은 작아진다.**

```text
/16  → 큰 네트워크
/20  → ↓
/24  → ↓
/28  → 작은 네트워크
```

---

## ⭐ AWS Subnet에서는 IP 5개가 예약된다

AWS에서 IPv4 Subnet을 사용할 때는 일반적인 IP 개수 계산과 차이가 있다.

AWS는 각 Subnet에서 **5개의 IP 주소를 예약**한다.

따라서:

```text
사용 가능한 IP
= 전체 IP 개수 - 5
```

이다.

예를 들어:

```text
10.0.0.0/24
```

의 경우:

```text
전체 IP
= 2^8
= 256

사용 가능한 IP
= 256 - 5
= 251
```

따라서 `10.0.0.0/24` Subnet에서는 **251개의 IP를 사용할 수 있다.**

---

## AWS에서 예약되는 5개의 IP

예를 들어 다음 Subnet이 있다고 가정한다.

```text
10.0.0.0/24
```

AWS에서는 다음과 같은 5개의 IP를 사용할 수 없다.

| IP | 용도 |
|---|---|
| `10.0.0.0` | 네트워크 주소 |
| `10.0.0.1` | VPC Router |
| `10.0.0.2` | AWS DNS 서버 |
| `10.0.0.3` | 향후 사용을 위해 예약 |
| `10.0.0.255` | 네트워크 브로드캐스트 주소 |

따라서 실제로 사용할 수 있는 범위는:

```text
10.0.0.4 ~ 10.0.0.254
```

이고 총:

```text
251개
```

이다.

### 시험용 암기

> **AWS IPv4 Subnet의 사용 가능 IP = 전체 IP - 5**

---

## `/28` Subnet의 사용 가능 IP

AWS IPv4 Subnet에서 사용할 수 있는 가장 작은 CIDR은 `/28`이다.

```text
10.0.0.0/28
```

Host Bit는:

```text
32 - 28 = 4bit
```

따라서 전체 IP는:

```text
2^4 = 16
```

AWS에서 5개를 예약하므로:

```text
16 - 5 = 11
```

즉:

> **`/28` Subnet의 사용 가능한 IP = 11개**

이 계산은 AWS 자격증 시험에서도 알아두면 유용하다.

---

## IPv4 Subnet 범위

AWS VPC의 IPv4 CIDR과 관련해서는 `/16 ~ /28` 범위를 기억해두면 된다.

```text
/16 → 가장 큰 범위
...
/24
...
/28 → 가장 작은 범위
```

즉 `/16`이 `/28`보다 숫자는 작지만 IP 주소의 범위는 훨씬 크다.

---

## IPv6

VPC와 Subnet은 IPv4뿐만 아니라 IPv6도 지원한다.

IPv6 역시 CIDR을 사용하여 네트워크 범위를 지정하지만, IPv4와 주소 체계와 계산 방식이 다르기 때문에 별도로 정리할 필요가 있다.

이번 내용에서는 **IPv4 CIDR과 Subnet IP 계산을 중심으로 이해**한다.

---

## VPC와 Subnet 전체 구조

지금까지 배운 내용을 하나로 연결하면 다음과 같다.

```text
AWS Region
│
└── VPC
    10.0.0.0/16
    │
    ├── AZ-a
    │   │
    │   ├── Public Subnet
    │   │   10.0.1.0/24
    │   │   └── EC2
    │   │
    │   └── Private Subnet
    │       10.0.2.0/24
    │       └── RDS
    │
    └── AZ-c
        │
        ├── Public Subnet
        │   10.0.3.0/24
        │   └── EC2
        │
        └── Private Subnet
            10.0.4.0/24
            └── RDS
```

여기에 인터넷 연결을 추가하면:

```text
EC2
 │
 ▼
Route Table
 │
 ▼
Internet Gateway
 │
 ▼
Internet
```

Private Subnet에서 외부 인터넷으로 나가는 경우에는 일반적으로 NAT Gateway를 사용한다.

```text
Private EC2
     │
     ▼
Route Table
     │
     ▼
NAT Gateway
     │
     ▼
Internet Gateway
     │
     ▼
Internet
```

---

## 핵심 개념 정리

| 개념 | 설명 |
|---|---|
| **VPC** | AWS에서 사용하는 논리적으로 격리된 가상 네트워크 |
| **Region** | VPC가 속하는 AWS의 지리적 영역 |
| **Subnet** | VPC의 IP 대역을 더 작은 네트워크로 나눈 것 |
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

---

## 🎯 반드시 기억할 내용

### 1. VPC

> **AWS에서 만드는 나만의 가상 데이터센터**

### 2. VPC는 Region 단위

> **하나의 VPC는 하나의 Region에 속한다.**

### 3. Subnet

> **VPC의 IP 대역을 더 작은 네트워크로 분할한 것**

### 4. Subnet과 AZ

> **하나의 Subnet은 하나의 AZ에만 존재한다.**

### 5. CIDR

```text
10.0.0.0/24
```

이면:

```text
Host Bit = 32 - 24 = 8
전체 IP = 2^8 = 256
```

### 6. AWS Subnet의 예약 IP

```text
사용 가능 IP
= 2^(Host Bit) - 5
```

예:

```text
/24 → 256 - 5 = 251
/28 → 16 - 5 = 11
```

---

## 한 문장으로 정리

> **VPC는 AWS에서 사용하는 논리적으로 격리된 가상 네트워크이며, VPC의 IP 대역을 Subnet으로 나누어 AWS 리소스를 배치한다. 하나의 Subnet은 하나의 AZ에만 존재하고, AWS IPv4 Subnet에서는 5개의 IP가 예약되므로 실제 사용 가능한 IP는 `2^(Host Bit) - 5`개이다.**

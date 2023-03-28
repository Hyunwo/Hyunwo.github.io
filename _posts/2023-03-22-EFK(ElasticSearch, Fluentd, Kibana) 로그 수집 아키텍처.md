---
title: "EFK(ElasticSearch, Fluentd, Kibana) 로그 수집 아키텍처"
categories:
- EFK
last_modified_at: 2023-03-21T23:10:00+09:00
toc: true
---

# 실습 아키텍처

<center><img src="https://user-images.githubusercontent.com/75519996/226637895-c9d8db85-0e04-465a-ad82-de4fef4e573a.png" width="50%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>

## Fluentd

- 로그의 수집, 파싱, 전송을 맡는다.
- 적은 리소스를 사용하면서 로그를 파싱하고 전송하는데 특화되어 있다.
- 규칙을 태그방식으로 정하기 때문에 사용성이 직관적이다.
    
    > <match> logtype.error> type ... </match>
    > 

## OpenSearch(ElasticSearch)

- 로그를 저장하는 저장소이다.
- 텍스트 데이터의 검색에 특화된 인덱싱 방법을 가지고 있기 때문에, 로그의 저장소 겸 검색 시스템으로 사용하기 좋다.
- 미리 스키마를 선언하지 않더라도 저장된 데이터 형식에 맞게 자동으로 인덱싱할 수 있는 것 또한 장점이다.

## OpenDashboard(Kibana)

- Opensearch와 연동되고, 사용하기 쉬운 시각화 도구이다.
- 기본으로 timeline 방식의 로그 시각화를 제공하고, SQL을 모르더라도 UI를 통해서 원하는 로그를 쉽게 찾고 추이를 볼 수 있다.
- 이미 데이터가 Opensearch에 쌓여있다면, 다양한 그래프를 작성하고 통합된 Dashboard도 구성할 수 있다.

# Fluentd로 로그 파싱하고 보내기

Fluent를 설치하기 전에 시스템이 최신 상태인지 확인하고 필요한 패키지를 설치한다.

```bash
sudo apt update
sudo apt install build-essential -y
```

Ruby gem을 설치한다.

```bash
sudo apt install ruby-rubygems -y
sudo apt install ruby-dev -y
```

```bash
sudo gem install fluentd --no-doc
```

fluentd 디렉토리를 설정한다.

```bash
fluentd --setup ./fluent
```

fluentd 실행 코드

```bash
fluentd -c ./fluent/fluent.conf -vv &
```
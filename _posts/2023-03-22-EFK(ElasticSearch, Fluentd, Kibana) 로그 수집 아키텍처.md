---
title: "EFK(ElasticSearch, Fluentd, Kibana) 로그 수집 아키텍처"
categories:
- EFK
last_modified_at: 2023-04-18T23:10:00+09:00
toc: true
---

# 실습 아키텍처

<center><img src="https://user-images.githubusercontent.com/75519996/226637895-c9d8db85-0e04-465a-ad82-de4fef4e573a.png" width="50%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>

## Fluentd

- 로그의 수집, 파싱, 전송을 맡는다.
- 적은 리소스를 사용하면서 로그를 파싱하고 전송하는데 특화되어 있다.
- 규칙을 태그방식으로 정하기 때문에 사용성이 직관적이다.

## OpenSearch(ElasticSearch)

- 로그를 저장하는 저장소이다.
- 텍스트 데이터의 검색에 특화된 인덱싱 방법을 가지고 있기 때문에, 로그의 저장소 겸 검색 시스템으로 사용하기 좋다.
- 미리 스키마를 선언하지 않더라도 저장된 데이터 형식에 맞게 자동으로 인덱싱할 수 있는 것 또한 장점이다.

## OpenDashboard(Kibana)

- Opensearch와 연동되고, 사용하기 쉬운 시각화 도구이다.
- 기본으로 timeline 방식의 로그 시각화를 제공하고, SQL을 모르더라도 UI를 통해서 원하는 로그를 쉽게 찾고 추이를 볼 수 있다.
- 이미 데이터가 Opensearch에 쌓여있다면, 다양한 그래프를 작성하고 통합된 Dashboard도 구성할 수 있다.

# Fluentd로 로그 파싱하고 보내기

## Fluentd 설치하기

Server1에 접속을 한다.
Fluentd를 설치하기 전에 시스템이 최신 상태인지 확인하고 필요한 패키지를 설치한다.

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

## 실습용 Log Generator 설치

‘loggen’ 이라는 디렉토리를 만들고 설치할 파일을 받아온다. 

```bash
mkdir loggen && cd loggen
wget https://github.com/mingrammer/flog/releases/download/v0.4.3/flog_0.4.3_linux_amd64.tar.gz
```

압축을 해제한다.

```bash
tar -xvf flog_0.4.3_linux_amd64.tar.gz
```

log는 json 버전과 apache 버전으로 생성한다.

json

```bash
./flog -f json -t log -s 1m -n 1000 -o $filename -w &
```

apache

```bash
./flog -f apache_common -t log -s 1m -n 1000 -o $filename -w &
```

# Opensearch(Elasticsearch)로 로그 저장하기

## Opensearch 설치하기

이번에는 Server2에서 opensearch를 설치한다.

물론 설치하기 전에는 항상 시스템이 최신 상태인지, 필요한 패키지는 설치되어 있는지 확인한다.

```bash
sudo apt update
sudo apt install build-essential -y
```

opensearch를 다운로드하고 압축을 해제한다.

```bash
wget https://artifacts.opensearch.org/releases/bundle/opensearch/2.4.0/opensearch-2.4.0-linux-x64.tar.gz
```

```bash
tar -xvf opensearch-2.4.0-linux-x64.tar.gz
```

환경변수를 설정해준다.

```bash
cd opensearch-2.4.0
export OPENSEARCH_HOME=$(pwd)
```

주요 디렉토리

- bin : 실행파일들의 위치이다.
- config : 설정 파일의 위치이다.
- data : opensearch가 데이터를 저장하는 위치이다.
- jdk : 내장 JDK가 있다.
- logs : log 디렉토리이다
- plugins : plugin의 위치이다.

Opensearch가 사용하는 기본 포트들

| Port number | OpenSearch component |
| --- | --- |
| 443 | OpenSearch Dashboards in AWS OpenSearch Service with encryption in transit(TLS) |
| 5601 | OpenSearch Dashboards |
| 9200 | OpenSearch REST API |
| 9250 | Cross-cluster search |
| 9300 | Node communication and transport |
| 9600 | Performance Analyzer |

opensearch.yml 파일을 연다.

```bash
vi $OPENSEARCH_HOME/config/opensearch.yml
```

아래와 같이 설정하고 저장한다.

```bash
network.host: 0.0.0.0
discovery.type: single-node
```

JVM heap 사이즈의 초기값과 최대값을 지정해준다.

자신의 EC2 서버 메모리의 절반을 추천한다. Xms와 Xmx는 같은 값을 가지는 것이 모니터링하고 관리하기 좋다.

```bash
vi $OPENSEARCH_HOME/config/jvm.options
```

```bash
-Xms128m
-Xmx128m
```

원활한 실습을 위해 security 관련 플러그인을 제거한다.

```bash
bin/opensearch-plugin remove opensearch-security
bin/opensearch-plugin remove opensearch-security-analytics
```

## Fluentd로 로그파일 읽어서 보내기

다시 Server1에서 fluentd 디렉토리의 fluent.conf파일을 열어 다음과 같이 json 버전과 regex를 이용한 apache 버전을 작성한다.

```bash
#json 버전
<source>
	@type tail
	tag log.json.*
	path /home/ubuntu/loggen/json-*.log
	pos_file positions-json.pos
	read_from_head true
	follow_inodes true

	<parse>
		@type json
		time_key datetime
		time_type string
		time_format %d/%b/%Y:%H:%M:%S %z
	</parse>
</source>
```

```bash
#regex를 이용한 apache버전
<source>
	@type tail
	tag log.apache.*
	path /home/ubuntu/loggen/apache-*.log
	pos_file positions-apache.pos
	read_from_head true
	follow_inodes true
	
	<parse>
		@type regexp
		expression /^(?<client>\S+) \S+ (?<userid>\S+) \[(?<datetime>[^\]]+)\] "(?<method>[A-Z]+) (?<request>[^ "]+)? (?<protocol>HTTP\/[0-9.]+)" (?<status>[0-9]{3}) (?<size>[0-9]+|-)/
		time_format %d/%b/%Y:%H:%M:%S %z
	</parse>
</source>
```

stdout으로 로그를 제대로 읽고 파싱할 수 있는지 확인한다.  아래 코드까지 적고 저장해준다.

```bash
<match log.json.**>
	@type stdout
</match>

<match log.apache.**>
	@type stdout
</match>
```

fluentd를 실행하여 로그가 정상적으로 올라가는지 확인한다.

```bash
fluentd -c ./fluent.conf -vv
```

참고로 설정 명령들은 fluentd 공식 문서를 참고하면 된다.

[Config File Syntax](https://docs.fluentd.org/configuration/config-file#1.-source-where-all-the-data-comes-from)

fluentd에서 opensearch 서버로 로그를 보내기 위해선 먼저 플러그인을 설치한다.

```bash
sudo fluent-gem install fluent-plugin-opensearch
```

dummy data를 보내서 opensearch로 잘 전송이 되는지 확인한다. $youor_opensearch_host 대신 EC2의 Private ip address를 넣어준다.

```bash
<source>
	@type dummy
	tag dummy
	dummy {"hello":"world"}
</source>

<match dummy>
	@type opensearch
	host $your_opensearch_host
	port 9200
	index_name fluentd-test
</match>
```

fluentd를 실행하고 curl로 index name인 fluentd-test가 출력되는지 확인한다.

```bash
fluentd -c ./fluent.conf -vv
```

```bash
curl -XGET http://$your_opensearch_host:9200/_cat/indices?v
```

이제 로그를 opensearch의 index로 보낸다.

```bash
<match log.apache.**>
	@type opensearch
	host $your_opensearch_host
	port 9200
	index_name apache-log
</match>

<match log.json.**>
	@type opensearch
	host $your_opensearch_host
	port 9200
	index_name json-log
</match>
```

log에 담긴 시간 값에 맞게 index를 생성할 수 있도록 지정한다.

```bash
<match log.json.**>
	@type opensearch
	hosts $your_opensearch_host:9200
	logstash_format true
	logstash_prefix json-timelog
	include_timestamp true
	time_key datetime
	time_key_format %d/%b/%Y:%H:%M:%S %z
</match>
```

- logstash에서 주로 쓰이던 패턴이기 때문에 logstash_format으로 세팅한다.
- include_timestamp true를 통해서 time_key를 바로 kibana(open dashboard)의 @timestamp로 매핑한다.
- time_key의 포맷을 알려줘야 파싱할 수 있다.

# Open Dashboard(Kibana)로 로그 시각화하기

## Open Dashboard 설치하기

Server2에서 Open Dashboard를 설치한다. 

```bash
wget https://artifacts.opensearch.org/releases/bundle/opensearch-dashboards/2.4.0/opensearch-dashboards-2.4.0-linux-x64.tar.gz
```

```bash
tar -zxf opensearch-dashboards-2.4.0-linux-x64.tar.gz
```

opensearch_dashboards.yml 파일을 열고 설정을 변경해준다.

```bash
vi config/opensearch_dashboards.yml
```

```bash
server.host: $your_ec2_public_dnsname
server.port: 5601
opensearch.hosts: [http://localhost:9200]
opensearch.ssl.verificationMode: none
opensearch.username: kibanaserver
opensearch.password: kibanaserver
```

실습을 위해 security 플러그인을 삭제한다.

```bash
./bin/opensearch-dashboards-plugin remove securityAnalyticsDashboards
./bin/opensearch-dashboards-plugin remove securitytDashboards
```

Open Dashboard를 실행한다. 실행 전 Opensearch도 실행되고 있어야 한다.

```bash
#Server2를 복제 후 $OPENSEARCH_HOME에서 Opensearch를 실행시킨다.
./bin/opensearch
```

```bash
#Open Dashboard 실행
./bin/opensearch-dashboards
```

$your_ec2_public_dnsname:5601 로 접속해서 다음과 같은 웹이 나오면 잘 연동된 것이다.

<center><img src="https://user-images.githubusercontent.com/75519996/232807236-f3aaf739-443d-44bf-aa54-53c64e5df6ab.png" width="100%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>

좌측 상단에 리스트 버튼을 눌러 Management - Stack Management로 접속한다. Index Patterns를 클릭하고 Index name을 검색하면 생성한 Index가 조회된다.

<center><img src="https://user-images.githubusercontent.com/75519996/232808318-b786ffcb-b0d8-4e62-9a3a-dbb2cd0aa57f.png" width="100%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>

<center><img src="https://user-images.githubusercontent.com/75519996/232808512-7276927b-520d-4861-ab70-90e8b75ae64b.png" width="100%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>

<center><img src="https://user-images.githubusercontent.com/75519996/232808694-9cdacf88-71b4-422f-ae4a-1fd0342398d5.png" width="100%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>
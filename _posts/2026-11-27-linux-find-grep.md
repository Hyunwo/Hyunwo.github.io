---
layout: post
title: "Linux find와 grep: 파일을 찾고, 그 안의 필요한 줄 찾기"
date: 2026-11-27 09:00:00 +0900
categories: [Linux]
tags: [Linux, find, grep, Log, Search]
---

서버에서 문제가 생기면 순서가 거의 정해져 있다. 먼저 로그 파일이 어디에 있는지 찾고, 그다음 그 안에서 오류가 적힌 줄을 확인한다. 도서관에서 제목을 보고 책을 찾는 일과, 책을 펼쳐 특정 문장을 찾는 일이 다른 것처럼 두 단계는 서로 다른 작업이고 쓰는 명령도 다르다. 이 글은 파일 자체를 찾는 `find`와 파일 내용에서 줄을 찾는 `grep`을 정리하고, 찾은 결과를 파일로 보관하는 방법까지 다룬다.

| 하려는 일 | 명령 | 조건으로 삼는 것 |
|---|---|---|
| 어느 폴더 아래에 어떤 파일이 있는지 찾기 | `find` | 이름, 종류, 크기, 수정 시간 |
| 파일 안에서 특정 문자열이 있는 줄 찾기 | `grep` | 파일에 적힌 내용 |

## 로그는 무엇이고 어떻게 생겼는가

로그는 프로그램에서 일어난 일을 시간 순서대로 적어 둔 일지다. 이 글의 실습에는 시각, 심각도, 오류 종류, 상세 내용이 한 줄에 담긴 예제 로그를 쓴다. 심각도는 보통 세 단계로 구분한다.

| 수준 | 의미 |
|---|---|
| `INFO` | 일반적인 진행 기록 |
| `WARN` | 주의할 상황 |
| `ERROR` | 오류가 발생했다는 뜻 |

### 실습 폴더와 예제 로그를 만든다

```bash
mkdir -p ~/linux-lab/search-lab/logs/archive ~/linux-lab/search-lab/reports
cd ~/linux-lab/search-lab
touch README.txt logs/archive/app-old.log

cat > logs/app.log <<'EOF'
2026-11-27 09:00:01 INFO APP_START service=api
2026-11-27 09:00:05 INFO REQUEST path=/health
2026-11-27 09:01:12 ERROR TIMEOUT db connection timed out
2026-11-27 09:02:30 WARN SLOW_QUERY took=2300ms
2026-11-27 09:03:44 ERROR DISK_FULL /var/log no space left
2026-11-27 09:04:10 INFO REQUEST path=/orders
2026-11-27 09:05:21 ERROR TIMEOUT upstream timed out
2026-11-27 09:06:02 INFO REQUEST path=/users
2026-11-27 09:07:15 ERROR CONNECT_FAILED cache unreachable
2026-11-27 09:08:40 WARN RETRY attempt=2
2026-11-27 09:09:33 ERROR TIMEOUT db connection timed out
2026-11-27 09:10:00 INFO APP_STOP service=api
EOF

wc -l logs/app.log      # 12 logs/app.log
```

`cat > 파일 <<'EOF'`는 `EOF`가 나올 때까지 입력한 내용을 파일에 저장하는 문법이다(히어 도큐먼트). 연습 파일을 한 번에 만들려고 사용했고, 같은 내용을 `nano logs/app.log`로 입력해도 결과는 같다. 이 로그는 설명을 위한 예시이므로, 강의에서 제공하는 파일을 쓸 때는 줄 수와 결과 숫자가 다를 수 있다.

## find로 조건에 맞는 파일을 찾으려면 어떻게 하는가

`find`는 지정한 위치에서 출발해 그 아래의 폴더들을 내려가며 조건에 맞는 항목을 찾는다. 파일 안에 적힌 문장을 찾는 명령이 아니라는 점에 유의한다.

```bash
find . -type f
find . -type f -name '*.log'
```

```text
./README.txt
./logs/app.log
./logs/archive/app-old.log          ← -name '*.log' 조건: app.log, app-old.log만 남는다
```

`find` 바로 뒤에는 찾기를 시작할 폴더를 쓴다. `.`은 현재 폴더이고, 이 위치부터 모든 하위 폴더를 훑는다. 출력 순서는 환경마다 다를 수 있다. 시작 위치를 `logs`로 바꾸면 범위가 좁아지고 경로 앞의 `./`도 사라진다.

```bash
find logs -type f -name '*.log'
# logs/app.log
# logs/archive/app-old.log
```

### find 조건은 하이픈이 붙은 단어 하나다

| 조건 | 의미 | 예시 |
|---|---|---|
| `-type f` | 폴더를 빼고 일반 파일만 | `find . -type f` |
| `-type d` | 폴더만 | `find . -type d` |
| `-name '패턴'` | 이름이 패턴과 맞는 항목 | `-name '*.log'` |
| `-iname '패턴'` | 대소문자를 구분하지 않는 이름 | `-iname 'readme*'` |
| `-mtime -1` | 최근 1일 이내에 수정된 항목 | `find logs -mtime -1` |
| `-size +10M` | 10MB보다 큰 항목 | `find /var/log -size +10M` |

`-type`은 단어 전체가 하나의 조건 이름이므로 앞에 하이픈을 붙여 적는다. `-type f`는 "종류가 일반 파일인 것"이라는 뜻이다. `find`가 방문하는 각 폴더의 이름을 조건으로 비교한다.

### 패턴은 왜 따옴표로 감싸는가

`'*.log'`처럼 따옴표로 감싸면 `*.log`라는 조건이 `find`에게 **그대로** 전달된다. 따옴표가 없으면 셸이 현재 폴더에서 `*.log`에 맞는 이름을 먼저 펼쳐 버려, 현재 폴더에 `.log` 파일이 있을 때 `find`가 의도와 다른 조건을 받는다. 패턴은 항상 따옴표로 감싸는 습관을 들인다.

### 실제 서버에서 로그를 찾을 때

```bash
sudo find /var/log -type f -name '*.log' 2>/dev/null
```

`/var/log`는 서버의 로그가 모이는 위치다. 일반 사용자는 읽을 수 없는 폴더가 있어서 `Permission denied` 오류가 섞여 나오기 때문에, 앞 글에서 배운 `2>/dev/null`로 오류를 버리는 경우가 많다. 로그 파일의 이름과 위치는 배포판과 서비스 설정에 따라 다르므로 `find`로 먼저 확인한다.

## grep으로 파일 안에서 필요한 줄을 찾으려면 어떻게 하는가

`grep`은 지정한 문자열이 들어 있는 **줄 전체**를 출력한다. 찾은 단어만 보여 주는 것이 아니라 그 줄 전체가 나오므로 발생 시각과 상황도 함께 읽을 수 있다.

```bash
grep -n -F ' ERROR ' logs/app.log
```

```text
3:2026-11-27 09:01:12 ERROR TIMEOUT db connection timed out
5:2026-11-27 09:03:44 ERROR DISK_FULL /var/log no space left
7:2026-11-27 09:05:21 ERROR TIMEOUT upstream timed out
9:2026-11-27 09:07:15 ERROR CONNECT_FAILED cache unreachable
11:2026-11-27 09:09:33 ERROR TIMEOUT db connection timed out
```

`찾을 말` 다음에 읽을 파일을 적는다. 오류 종류나 서비스 이름처럼 확인하려는 문자열을 정하면 긴 로그에서도 살펴볼 범위를 줄일 수 있다.

### 자주 쓰는 grep 옵션

| 옵션 | 의미 |
|---|---|
| `-n` | 일치한 줄이 원본 파일의 몇 번째 줄인지 함께 표시 |
| `-F` | 검색어를 특별한 패턴이 아니라 **글자 그대로** 찾는다 |
| `-i` | 대소문자를 구분하지 않고 비교한다 (파일 내용은 바꾸지 않는다) |

### `-i`는 무엇을 바꾸는가

```bash
grep -n -F 'timeout' logs/app.log        # 아무 줄도 나오지 않는다
grep -n -F -i 'timeout' logs/app.log
# 3:2026-11-27 09:01:12 ERROR TIMEOUT db connection timed out
# 7:2026-11-27 09:05:21 ERROR TIMEOUT upstream timed out
# 11:2026-11-27 09:09:33 ERROR TIMEOUT db connection timed out
```

로그에는 `TIMEOUT`이 대문자로 적혀 있으므로 소문자 `timeout`으로는 찾을 수 없다. `-i`를 붙이면 대소문자를 같은 것으로 비교해 세 줄이 나온다. 검색할 때 비교 방식만 바뀔 뿐 파일의 글자가 바뀌는 것은 아니다.

### `-F`는 왜 쓰는가

`grep`은 기본적으로 검색어를 **패턴(정규 표현식)**으로 해석한다. 점(`.`)은 "아무 글자 하나", 별표(`*`)는 "앞 글자의 반복"이라는 검색 규칙이다. `-F`를 붙이면 이런 해석 없이 적은 문자열 그대로 찾는다.

```bash
grep -c 'ERROR.TIMEOUT' logs/app.log        # 3  (점이 공백 한 글자와도 일치)
grep -c -F 'ERROR.TIMEOUT' logs/app.log     # 0  (점이 들어 있는 줄은 없음)
```

`-c`는 일치한 줄의 수만 출력한다. IP 주소(`10.0.0.1`)나 파일 이름(`app.log`)처럼 점이 들어간 문자열을 찾을 때 `-F` 없이 검색하면 의도하지 않은 줄까지 일치할 수 있다. 정규 표현식이 필요한 경우가 아니라면 `-F`가 안전하다.

### 검색어 앞뒤 공백도 검색어의 일부다

예제에서는 `' ERROR '`처럼 앞뒤에 공백을 넣었다. 로그의 심각도 칸만 정확히 고르기 위해서다. 공백 없이 `ERROR`만 찾으면 `ERROR_COUNT=3` 같은 다른 용도의 문자열이 섞여 들어올 수 있다. 공백 한 칸 차이로 결과가 달라지므로, 따옴표 안의 공백이 실제 로그 형식과 맞는지 확인한다.

### 그 밖에 현업에서 자주 쓰는 옵션

| 옵션 | 의미 | 예시 |
|---|---|---|
| `-r` | 하위 폴더의 모든 파일을 검색 | `grep -rn -F ' ERROR ' logs/` |
| `-v` | 일치하지 **않는** 줄만 출력 | `grep -v -F ' INFO ' logs/app.log` |
| `-c` | 일치한 줄의 수만 출력 | `grep -c -F ' ERROR ' logs/app.log` |
| `-A 2` / `-B 2` | 일치한 줄의 뒤/앞 2줄도 함께 출력 | 오류 직전 상황 확인 |
| `-l` | 일치한 줄이 있는 파일 이름만 출력 | 어느 파일에 있는지 찾을 때 |
| `-E` | 정규 표현식(확장) 사용 | `grep -E 'ERROR\|WARN' 파일` |

## find와 grep을 함께 쓰면 무엇이 달라지는가

실제 상황에서는 어느 파일에 있는지도 모르는 경우가 많다. 이때 `find`로 파일을 좁히고 `grep`으로 내용을 찾는다.

```bash
find logs -type f -name '*.log' -exec grep -l -F ' ERROR ' {} +
# logs/app.log
```

`-exec`는 찾은 파일마다 명령을 실행하게 하고, `{}`가 찾은 파일 이름으로 바뀐다. 마지막 `+`는 명령의 끝을 뜻한다. `grep -l`은 일치하는 줄이 있는 파일 이름만 출력하므로, 오류가 있는 로그 파일 목록이 나온다. 단순히 폴더 안 전체를 훑을 때는 `grep -rn -F ' ERROR ' logs/`가 더 짧다.

## 찾은 오류 기록을 파일로 보관하려면 어떻게 하는가

앞 글에서 배운 리다이렉션을 연결해 골라낸 줄을 별도 파일로 저장한다.

```bash
grep -F ' ERROR ' logs/app.log > reports/errors.log
wc -l < reports/errors.log      # 5
cat -n reports/errors.log
```

`>` 앞의 명령이 출력하는 결과가 화면 대신 `reports/errors.log`에 저장된다. 이 파일은 다음 글에서 다시 가공하는 재료가 된다. 새 파일이 `.log`로 끝나므로 `find . -type f -name '*.log'`를 다시 실행하면 `./reports/errors.log`도 함께 나온다. 로그를 모은 폴더 안에 결과 파일을 같이 두면 이후 검색에 섞여 나오므로, 결과를 `reports` 같은 별도 폴더에 두는 편이 좋다.

## 검색 결과가 없을 때는 어떻게 확인하는가

아무 줄도 나오지 않는다고 "문제가 없다"고 바로 결론 내리면 안 된다. 먼저 검색 조건이 맞는지 살펴본다.

1. **범위**: 검색한 폴더와 파일이 맞는가. 다른 로그 파일에 기록되어 있을 수 있다.
2. **대소문자**: `error`와 `ERROR`는 다르다. `-i`로 다시 확인한다.
3. **표현**: 로그에 실제로 그렇게 적혀 있는가. `Error`, `FAIL`, `Exception` 등 다른 표기일 수 있다.
4. **공백과 기호**: 검색어 앞뒤 공백, `.`나 `*`가 패턴으로 해석되지 않았는가. `-F`를 쓰고 있는지 본다.

`grep`은 명령이 끝날 때 결과를 숫자로 남긴다. `echo $?`로 확인할 수 있다.

| 종료 상태 | 의미 |
|---|---|
| `0` | 일치하는 줄을 찾았다 |
| `1` | 일치하는 줄이 없다 |
| `2` 등 그 밖의 값 | 파일을 읽지 못하는 등 오류가 있었다 |

`1`은 "찾을 게 없었다"는 정상적인 결과이고, `2`는 "검색 자체가 제대로 되지 않았다"는 뜻이다. 둘을 구분하면 파일 경로를 잘못 적은 것인지, 정말 해당 기록이 없는 것인지 알 수 있다.

## 용어 정리

| 용어 | 설명 |
|---|---|
| 로그 | 프로그램에서 일어난 일을 시간 순서대로 적어 둔 일지 |
| `INFO` / `WARN` / `ERROR` | 일반 진행 / 주의할 상황 / 오류 발생을 나타내는 로그 수준 |
| `find` | 지정한 위치 아래에서 이름, 종류 등 조건에 맞는 파일과 폴더를 찾는 명령 |
| `-type f` | 폴더를 제외하고 일반 파일만 고르는 `find` 조건 |
| `-name` | 이름이 패턴과 맞는 항목을 고르는 `find` 조건 |
| `grep` | 파일에서 문자열이 들어 있는 줄을 찾아 출력하는 명령 |
| `-n` | 일치한 줄의 원본 줄 번호를 표시하는 `grep` 옵션 |
| `-F` | 검색어를 패턴이 아니라 글자 그대로 찾는 `grep` 옵션 |
| `-i` | 대소문자를 구분하지 않고 검색하는 `grep` 옵션 |
| 정규 표현식 | `.`, `*` 같은 기호로 문자열의 규칙을 표현하는 검색 패턴 |
| 종료 상태 | 명령이 끝날 때 남기는 숫자. `grep`은 찾으면 0, 없으면 1 |
| 히어 도큐먼트 | `<<'EOF'` 형태로 여러 줄을 한 번에 입력하는 셸 문법 |

---
title: "ChatGPT API를 활용한 대화형 프로그램 만들기"
categories:
- ChatGPT API
last_modified_at: 2023-04-25T23:10:00+09:00
toc: true
---

# 사용법

먼저 ChatGPT API를 사용하기 위해서는 openai 패키지를 설치해야 한다.

```bash
!pip install openai
import openai
```

ChatGPT API를 사용하기 위해서는 API키를 받아와야 한다.

 **[platform.openai.com](https://platform.openai.com/overview)**에 접속을 해서 상단 프로필의 View API Keys를 클릭하고 Create new Secrete key를 눌러서 받을 수 있다. 주의할 점은 페이지를 나가면 키를 다시 볼 수 없으니 다른 곳에 복사해 놓는 것이 좋다.

```python
openai.api_key = "API Key"
```

```bash
messages = []
while True:
    user_content = input("user : ")
    messages.append({"role": "user", "content": f"{user_content}"})
    completion = openai.ChatCompletion.create(model="gpt-3.5-turbo", messages=messages) 
    assistant_content = completion.choices[0].message["content"].strip()
    messages.append({"role": "assistant", "content": f"{assistant_content}"})
    print(f"ChatBot : {assistant_content}"
```

모델은 자연어 처리에 가장 적합한 “gpt-3.5-turbo”를 사용했다.

messages는 role과 content의 속성을 가지는데 role은 system, user(사용자), assistant(챗봇) 중 하나의 값이고 content는 역할에 따른 메시지이다. 실습에서는 system을 사용하지 않았다.

messages의 형식은 다음과 같다

```bash
messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Who won the world series in 2020?"},
        {"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."},
        {"role": "user", "content": "Where was it played?"}
    ]
```

자세한 내용은 openai 홈페이지를 참고한다.

> [https://platform.openai.com/docs/guides/chat/introduction](https://platform.openai.com/docs/guides/chat/introduction)
>[https://platform.openai.com/docs/api-reference/chat](https://platform.openai.com/docs/api-reference/chat)  
>[https://youtu.be/b-QeMi1A2go](https://youtu.be/b-QeMi1A2go)


## [전체 코드]

<center><img src="https://user-images.githubusercontent.com/75519996/234300878-864f12dd-1561-447b-ac9b-2fa558a8304d.png" width="70%" height="70%" style="margin-top: 20px; margin-bottom: 20px;"></center>

## [출력]

<center><img src="https://user-images.githubusercontent.com/75519996/234301151-e2207e01-c2d2-4723-a291-bc96ff079469.png" width="100%" height="50%" style="margin-top: 20px; margin-bottom: 20px;"></center>
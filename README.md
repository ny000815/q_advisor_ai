# ft_mini_ls

![gif](https://github.com/ny000815/q_advisor_ai/image/q_ad.gif)

## Overview

q_advisor is a question-answering system based on the content of PDF documents to help study kdb+ and q language. It uses Claude AI to generate answers to user queries using relevant information extracted from PDFs.

## Architecture

![alt](https://github.com/ny000815/q_advisor_ai/image/architecture.png)

## Requirement

- macOS
- python
- Claude API subscription

## Usage

```
git clone ...
cd q_advisor_ai
python3 -m venv venv
source venv/bin/activate
pip install Flask anthropic faiss-cpu joblib numpy scikit-learn markdown2
export ANTHROPIC_API_KEY='put_your_key_here'
python app.py
```

## Other Service

GPTs version is available here.
[Q advisor fro kdb+](https://chatgpt.com/g/g-xsRgQV9lF-q-advisor-for-kdb)

## Licence

[MIT](https://github.com/ny000815/q_advisor_ai/LICENSE)

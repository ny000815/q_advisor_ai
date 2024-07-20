from flask import Flask, request, jsonify, render_template
import anthropic
import faiss
import joblib
import numpy as np
import re
from sklearn.feature_extraction.text import TfidfVectorizer
import logging
import markdown2

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

# Load pre-computed vector data
try:
    loaded_index = faiss.read_index('./vector_data/kdbplus_doc_index.faiss')
    loaded_vectorizer = joblib.load('./vector_data/vectorizer.joblib')
    loaded_chunks = joblib.load('./vector_data/chunks.joblib')
    app.logger.info("Vector data loaded successfully")
except Exception as e:
    app.logger.error(f"Error loading vector data: {str(e)}")

def custom_code_block_processor(text):
    def replace_code_block(match):
        code = match.group(1).strip()  # Remove leading/trailing whitespace
        return f'<pre><code class="language-q">{code}</code></pre>'
    
    return re.sub(r'```q(.*?)```', replace_code_block, text, flags=re.DOTALL)

def preprocess_text(text):
    text = re.sub(r'http\S+', '', text)
    text = re.sub(r'Copyright © \S+', '', text)
    text = re.sub(r'[^\w\s\[\]{}()]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def get_context(sentences, index, window=1):
    start = max(0, index - window)
    end = min(len(sentences), index + window + 1)
    return ' '.join(sentences[start:end])

def query_faiss(query, index, vectorizer, chunks, k=5):
    query_vector = vectorizer.transform([preprocess_text(query)]).toarray().astype('float32')
    faiss.normalize_L2(query_vector)
    similarities, indices = index.search(query_vector, k)
    
    results = []
    for i, idx in enumerate(indices[0]):
        header, content = chunks[idx]
        sentences = [s.strip() for s in content.split('.') if s.strip()]
        sentence_vectors = vectorizer.transform(sentences).toarray()
        sentence_similarities = query_vector.dot(sentence_vectors.T)
        best_sentence_idx = sentence_similarities.argmax()
        context = get_context(sentences, best_sentence_idx)
        results.append({
            'header': header,
            'context': context,
            'similarity': float(similarities[0][i])
        })
    
    unique_results = []
    seen_contexts = set()
    for result in results:
        if result['context'] not in seen_contexts:
            unique_results.append(result)
            seen_contexts.add(result['context'])
    return unique_results[:k]

def get_context_from_query(query):
    results = query_faiss(query, loaded_index, loaded_vectorizer, loaded_chunks)
    context = ""
    for result in results:
        context += f"Header: {result['header']}\n"
        context += f"Context: {result['context']}\n\n"
    return context

def ask_claude(query, context):
    client = anthropic.Anthropic()
    
    message = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=1000,
        system="You are an AI assistant knowledgeable about programming, especially KDB+ and q. Provide brief, short, clear answers. For each concept you explain, include a short, practical code example wrapped in ```q``` markdown code blocks. Keep explanations concise and to the point.",
        messages=[
            {
                "role": "user",
                "content": f"Question: {query}\n\nAnswer concisely. Use context if relevant: {context}"
            }
        ]
    )
    
    # Extract the text content from the message
    answer = message.content[0].text if message.content else "Sorry, I couldn't generate an answer."
    
    # Pre-process the answer to handle code blocks
    answer = custom_code_block_processor(answer)
    
    # Convert to HTML, preserving our custom-processed code blocks
    answer_html = markdown2.markdown(answer, extras=["fenced-code-blocks"])
    return answer_html

@app.route('/')
def index():
    app.logger.info("Rendering index.html")
    return render_template('index.html')

@app.route('/api/ask', methods=['POST'])
def api_ask():
    data = request.json
    query = data['query']
    app.logger.info(f"Received query: {query}")
    context = get_context_from_query(query)
    answer = ask_claude(query, context)
    app.logger.info(f"Generated answer: {answer[:100]}...")  # Log first 100 chars of answer
    return jsonify({'answer': answer})

if __name__ == '__main__':
    app.run(debug=True)
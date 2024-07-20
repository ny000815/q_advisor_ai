import io
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer, LTFigure, LTRect
import re
from sklearn.feature_extraction.text import TfidfVectorizer
import faiss
import numpy as np
import joblib
from scipy.sparse import csr_matrix
from pdfminer.pdfparser import PDFSyntaxError

try:
    chunks = extract_pdf_content(pdf_path)
except PDFSyntaxError as e:
    print(f"PDFSyntaxError: {e}")
except FileNotFoundError as e:
    print(f"FileNotFoundError: {e}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")

print("Starting PDF content extraction...")

def is_header(text):
    return (text.isupper() and len(text.split()) <= 7) or \
           any(text.lower().startswith(prefix) for prefix in ["chapter ", "section ", "kdb+ - "]) or \
           (text.strip().endswith(':') and len(text.split()) <= 7)

def extract_pdf_content(pdf_path):
    chunks = []
    current_chunk = ""
    current_header = ""

    for page_layout in extract_pages(pdf_path):
        for element in page_layout:
            if isinstance(element, LTTextContainer):
                text = element.get_text().strip()
                if text:
                    if is_header(text):
                        if current_chunk:
                            chunks.append((current_header, current_chunk.strip()))
                            current_chunk = ""
                        current_header = text
                    else:
                        current_chunk += text + " "
                    if len(current_chunk) > 1000:
                        chunks.append((current_header, current_chunk.strip()))
                        current_chunk = ""
            elif isinstance(element, (LTFigure, LTRect)):
                current_chunk += "[FIGURE_OR_TABLE] "

    if current_chunk:
        chunks.append((current_header, current_chunk.strip()))

    return chunks

def preprocess_text(text):
    # URLの除去
    text = re.sub(r'http\S+', '', text)
    # 著作権表示の除去
    text = re.sub(r'Copyright © \S+', '', text)
    # 特殊文字の除去（ただし、コードブロックは保持）
    text = re.sub(r'[^\w\s\[\]{}()]', ' ', text)
    # 複数の空白を単一の空白に置換
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def vectorize_text(chunks):
    preprocessed_chunks = [preprocess_text(chunk[1]) for chunk in chunks]
    vectorizer = TfidfVectorizer(stop_words='english')
    vectors = vectorizer.fit_transform(preprocessed_chunks)
    return vectorizer, vectors

def create_faiss_index(vectors):
    if isinstance(vectors, csr_matrix):
        vectors = vectors.toarray()  # 疎行列を密行列に変換
    vectors = vectors.astype(np.float32)  # float32型に変換
    
    dimension = vectors.shape[1]
    index = faiss.IndexFlatIP(dimension)  # コサイン類似度のためにInnerProductを使用
    faiss.normalize_L2(vectors)  # ベクトルを正規化
    index.add(vectors)
    return index

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
            'similarity': similarities[0][i]
        })
    
    # 重複を削除
    unique_results = []
    seen_contexts = set()
    for result in results:
        if result['context'] not in seen_contexts:
            unique_results.append(result)
            seen_contexts.add(result['context'])
    return unique_results[:k]  # 上位k件のユニークな結果を返す

# メイン処理
pdf_path = './pdf_processing/kdbdoc.pdf'
chunks = extract_pdf_content(pdf_path)
vectorizer, vectors = vectorize_text(chunks)
index = create_faiss_index(vectors)

# インデックスとベクトライザーを保存
faiss.write_index(index, './vector_data/kdbplus_doc_index.faiss')
joblib.dump(vectorizer, './vector_data/vectorizer.joblib')
joblib.dump(chunks, './vector_data/chunks.joblib')  # チャンクも保存

# 使用例
loaded_index = faiss.read_index('./vector_data/kdbplus_doc_index.faiss')
loaded_vectorizer = joblib.load('./vector_data/vectorizer.joblib')
loaded_chunks = joblib.load('./vector_data/chunks.joblib')

query = "What is namespace?"
results = query_faiss(query, loaded_index, loaded_vectorizer, loaded_chunks)

for result in results:
    print(f"Similarity: {result['similarity']}")
    print(f"Header: {result['header']}")
    print(f"Context: {result['context']}")
    print()
    

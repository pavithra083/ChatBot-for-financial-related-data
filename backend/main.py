
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import os
import uuid
import shutil
from dotenv import load_dotenv

from services.pdf_processor import PDFProcessor
from services.llm_service import LLMService
from services.excel_generator import ExcelGenerator

# environment variables
load_dotenv()

app = FastAPI(
    title="Financial PDF Chatbot API",
    description="AI-powered API for analyzing financial PDF documents",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
pdf_processor = PDFProcessor()
llm_service = LLMService()
excel_generator = ExcelGenerator()

# Store active document (in production, use database)
current_document = None

@app.get("/")
async def root():
    return {
        "message": "Financial PDF Chatbot API",
        "status": "running", 
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "upload": "/upload",
            "chat": "/chat", 
            "download": "/download/excel"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "Financial PDF Chatbot API",
        "openrouter_configured": bool(os.getenv('OPENROUTER_API_KEY'))
    }

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload and process a financial PDF document
    """
    global current_document
    
    print(f"📁 Received upload request for file: {file.filename}")
    
    if not file.filename.lower().endswith('.pdf'):
        error_msg = "Only PDF files are supported"
        print(f"❌ {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Create temporary file
    file_id = str(uuid.uuid4())
    temp_path = f"temp_{file_id}.pdf"
    
    try:
        print(f"📁 Saving file: {file.filename} -> {temp_path}")
        
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Check file size
        file_size = os.path.getsize(temp_path)
        print(f"📊 File saved successfully. Size: {file_size} bytes")
        
        if file_size == 0:
            raise Exception("Uploaded file is empty")
        
        print(f"🔍 Starting PDF processing...")
        
        # Process PDF
        processed_data = pdf_processor.extract_financial_data(temp_path)
        
        print(f"✅ PDF processed successfully!")
        print(f"   - Pages: {processed_data['summary']['total_pages']}")
        print(f"   - Tables: {processed_data['summary']['table_count']}")
        print(f"   - Text length: {len(processed_data['raw_text'])} characters")
        print(f"   - Amounts found: {len(processed_data['financial_metrics']['amounts'])}")
        print(f"   - Dates found: {len(processed_data['financial_metrics']['dates'])}")
        
        # Store document data
        current_document = {
            'id': file_id,
            'filename': file.filename,
            'processed_data': processed_data
        }
        
        # Clean up temporary file
        os.remove(temp_path)
        print(f"🗑️ Temporary file cleaned up: {temp_path}")
        
        response_data = {
            "id": file_id,
            "filename": file.filename,
            "pages": processed_data['summary']['total_pages'],
            "tables_found": processed_data['summary']['table_count'],
            "has_financial_data": processed_data['summary']['has_financial_data'],
            "status": "processed"
        }
        
        print(f"✅ Upload completed successfully: {response_data}")
        return response_data
        
    except Exception as e:
        print(f"❌ PDF processing failed!")
        print(f"❌ Error type: {type(e).__name__}")
        print(f"❌ Error message: {str(e)}")
        
        # Print full traceback for debugging
        import traceback
        print(f"❌ Traceback:")
        traceback.print_exc()
        
        # Clean up on error
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                print(f"🗑️ Temporary file cleaned up after error: {temp_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Could not clean up temp file: {cleanup_error}")
        
        error_detail = f"PDF processing failed: {str(e)}"
        if "pdfplumber" in str(e).lower():
            error_detail += ". Please ensure the PDF is not encrypted or corrupted."
        
        raise HTTPException(status_code=500, detail=error_detail)

@app.post("/chat")
async def chat_with_document(request: dict):
    """
    Ask questions about the uploaded document
    """
    global current_document
    
    if not current_document:
        raise HTTPException(status_code=400, detail="Please upload a PDF document first")
    
    question = request.get('message')
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    
    print(f"💬 Chat request: {question}")
    
    try:
        response = await llm_service.ask_question(
            question, 
            current_document['processed_data']
        )
        
        print(f"🤖 AI response generated (confidence: {response['confidence']})")
        return response
        
    except Exception as e:
        print(f"❌ Chat processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

@app.get("/download/excel")
async def download_excel():
    """
    Download financial data as Excel file
    """
    global current_document
    
    if not current_document:
        raise HTTPException(status_code=400, detail="No document available for download. Please upload a PDF first.")
    
    print(f"📊 Generating Excel download for: {current_document['filename']}")
    
    try:
        excel_file = excel_generator.generate_financial_report(
            current_document['processed_data']
        )
        
        print(f"✅ Excel file generated successfully")
        
        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=financial_analysis_{current_document['id']}.xlsx"
            }
        )
    except Exception as e:
        print(f"❌ Excel generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")

@app.get("/document/status")
async def get_document_status():
    """Get current document status"""
    if current_document:
        return {
            "has_document": True,
            "filename": current_document['filename'],
            "pages": current_document['processed_data']['summary']['total_pages'],
            "tables": current_document['processed_data']['summary']['table_count'],
            "text_length": len(current_document['processed_data']['raw_text'])
        }
    return {"has_document": False}

@app.get("/debug/env")
async def debug_environment():
    """Debug endpoint to check environment setup"""
    return {
        "openrouter_api_key_set": bool(os.getenv('OPENROUTER_API_KEY')),
        "openrouter_api_key_length": len(os.getenv('OPENROUTER_API_KEY', '')),
        "current_document": bool(current_document),
        "python_version": os.sys.version
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Financial PDF Chatbot API...")
    print("📊 Debug endpoints available:")
    print("   - http://localhost:8000/health")
    print("   - http://localhost:8000/debug/env")
    print("   - http://localhost:8000/document/status")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
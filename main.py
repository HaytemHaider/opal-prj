import random
import datetime
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional
from opal_tools_sdk import ToolsService, tool

app = FastAPI(title="Sample Opal Tools Service")
tools_service = ToolsService(app)

# Models for the tools
class GreetingParameters(BaseModel):
    name: str = Field(..., description="Name of the person to greet")
    language: Optional[str] = Field(None, description="Language for greeting (defaults to random)")

class DateParameters(BaseModel):
    format: Optional[str] = Field("%Y-%m-%d", description="Date format (defaults to ISO format)")

@tool("greeting", "Greets a person in a random language (English, Spanish, or French)")
async def greeting(parameters: GreetingParameters):
    """Greets a person in a random language."""
    # Get parameters
    name = parameters.name
    language = parameters.language
    
    # If language not specified, choose randomly
    if not language:
        language = random.choice(["english", "spanish", "french"])
    
    # Generate greeting based on language
    if language.lower() == "spanish":
        greeting = f"¡Hola, {name}! ¿Cómo estás?"
    elif language.lower() == "french":
        greeting = f"Bonjour, {name}! Comment ça va?"
    else:  # Default to English
        greeting = f"Hello, {name}! How are you?"
    
    return {
        "greeting": greeting,
        "language": language
    }

@tool("todays-date", "Returns today's date in the specified format")
async def todays_date(parameters: DateParameters):
    """Returns today's date."""
    # Get parameters
    date_format = parameters.format
    
    # Get today's date
    today = datetime.datetime.now()
    
    # Format the date
    formatted_date = today.strftime(date_format)
    
    return {
        "date": formatted_date,
        "format": date_format,
        "timestamp": today.timestamp()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

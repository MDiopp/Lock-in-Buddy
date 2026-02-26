from fastapi import FastAPI
from enum import IntEnum
from pydantic import BaseModel, Field
import mediapipe as mp

app = FastAPI()

@app.get('/')
def index():
    return {"message" : "lalallal"}
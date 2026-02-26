from fastapi import FastAPI, HTTPException
from enum import Enum
from pydantic import BaseModel, Field
import mediapipe as mp

class ModelName(str, Enum):
    goku = "goku"
    vegeta = "vegeta"
    gotenks = "gotenks"
app = FastAPI()

@app.get("/")
async def root():
    return {"message" : "Hello World"}

@app.get("/items/{item_id}")
async def read_item(item_id: int) -> dict:
    return {"item_id" : item_id}

@app.get("/models/{model_name}")
async def do_attack(model_name: ModelName) -> dict:
    if model_name == ModelName.goku:
        return {"Goku: fight me, if you're ready to die...": "Dragon fist!!!!"}
    elif model_name == ModelName.vegeta:
        return {"Vegeta: In near moments, all you'll be feeling, is oblivion!!!": "Final Flash!!!!!"}
    elif model_name == ModelName.gotenks:
        return {"Gotenks: Yea just leave everything to me": "Super ghost kamikaze attack!!!"}

@app.get("/items/")
async def read_item(skip: int = 0, limit: int = 10) -> dict:
    return {"result" : skip + limit}

#!/usr/bin/env python
"""Enrollment service main module."""

from fastapi import FastAPI

app = FastAPI(title="enrollment-service")


@app.get("/")
async def root():
    return {"message": "enrollment service is running"}
import asyncio
import os
import sys

from app.api.routes.upload import _process_evidence
from app.core.config import settings

async def test():
    file_id = "test-123"
    path = "/home/anbu/26_class/AIVentra_org/test_data/autopsy_report_AIV_2041.txt"
    file_type = "txt"
    original_name = "autopsy_report_AIV_2041.txt"
    
    print("Running process_evidence...")
    try:
        await _process_evidence(file_id, path, file_type, original_name)
        print("Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())

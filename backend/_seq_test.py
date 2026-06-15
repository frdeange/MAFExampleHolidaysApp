"""Quick check of the sequential pipeline (Act 1)."""

import asyncio
from contextlib import AsyncExitStack

from agents import build_workflow, create_mcp_tools


async def main() -> None:
    mt = create_mcp_tools()
    async with AsyncExitStack() as st:
        for t in mt:
            await st.enter_async_context(t)
        wf = build_workflow(mt)
        result = await wf.run(
            "I love beaches and nightlife, I dislike cold cities and big museums. "
            "I want to travel in July."
        )
        outs = result.get_outputs()
        print("=== number of outputs:", len(outs))
        for o in outs:
            s = str(o)
            print("\n---- OUTPUT ----")
            print(s[:1500])


if __name__ == "__main__":
    asyncio.run(main())

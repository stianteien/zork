from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
import requests
from google.adk.tools.openapi_tool import OpenAPIToolset



openapi_spec = requests.get("http://localhost:8005/openapi.json").text

api_toolset = OpenAPIToolset(
    spec_str=openapi_spec,
)


root_agent = LlmAgent(
    model=LiteLlm(model="gpt-5-mini"), # LiteLLM model string format
    name='root_agent',
    description='A helpful assistant for user questions.',
    instruction='Help the user with their requests using available tools.',
    tools=[api_toolset],
)

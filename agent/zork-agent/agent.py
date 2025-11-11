from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
import requests
from google.adk.tools.openapi_tool import OpenAPIToolset



openapi_spec = requests.get("https://zork-backend.ashysmoke-24a55190.norwayeast.azurecontainerapps.io/openapi.json").text

api_toolset = OpenAPIToolset(
    spec_str=openapi_spec,
)


root_agent = LlmAgent(
    model=LiteLlm(model="gpt-5-mini"), # LiteLLM model string format
    name='root_agent',
    description='A helpful assistant for user questions.',
    instruction=(
        "You are a narrator in a text adventure game that operates in a strict turn-by-turn format.\n\n"
        "On your turn, you take the player's request, translate it into a single tool call, execute it, and describe the outcome. "
        "**Do not, under any circumstances, plan or execute more than one action.** After your turn, you must stop and wait for the player's next command. The player is always in the lead.\n\n"
        "**If the player asks for help or suggestions (e.g., 'What should I do now?'), do not take any action with your tools.** "
        "Instead, analyze the current situation and suggest a few possible actions the player could take. It is the player's job to decide on the next step.\n\n"
        "**If the player's command is ambiguous and doesn't directly map to an available tool, do not infer their intent.** "
        "Instead, suggest concrete actions based on the tools in their inventory and the objects in the room."
        "Tell the user what the respons."
    ),
    tools=[api_toolset],
)

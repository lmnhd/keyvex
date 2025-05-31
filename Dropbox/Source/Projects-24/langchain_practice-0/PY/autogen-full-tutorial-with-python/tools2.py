from typing import Annotated
from pydantic import BaseModel, Field

from tools import Operator, assistant, user_proxy


class CalculatorInput(BaseModel):
    a: Annotated[int, Field(description="The first number.")]
    b: Annotated[int, Field(description="The second number.")]
    operator: Annotated[Operator, Field(description="The operator.")]


def calculator(input: Annotated[CalculatorInput, "Input to the calculator."]) -> int:
    if input.operator == "+":
        return input.a + input.b
    elif input.operator == "-":
        return input.a - input.b
    elif input.operator == "*":
        return input.a * input.b
    elif input.operator == "/":
        return int(input.a / input.b)
    else:
        raise ValueError("Invalid operator")
    
assistant.register_for_llm(name="calculator", description="A calculator tool that accepts nested expression as input")(
    calculator
)
user_proxy.register_for_execution(name="calculator")(calculator)

print(assistant.llm_config['tools'])

chat_result = user_proxy.initiate_chat(assistant, message="What is (1423 - 123) / 3 + (32 + 23) * 5?")
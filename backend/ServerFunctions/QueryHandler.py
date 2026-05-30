import ServerFunctions.GeminiAPI as GeminiAPI

def handleInput(input):
    processVideoInput(input.video)
    processTextInput(input.text)

def processVideoInput(input):
    print("In proc VideoInput")
    print("Video Input: ", input)
    geminiQuery = """
    You are an expert in cooking
    """
    return GeminiAPI.GenerateResponse()
    
#placeholder
def processTextInput(input):
    print("In proc TextInput")
    print("Text Input: ", input)
    return GeminiAPI.GenerateResponse()
    
import OpenAI from 'openai';
type C = OpenAI.ChatCompletionChunk;
type R = OpenAI.ChatCompletionChunk.Choice.Delta.FunctionCall;
type O = OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall;

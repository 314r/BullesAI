import { Configuration, OpenAIApi } from "openai"
import { Form, useActionData, useNavigation } from "@remix-run/react"
import { json } from "@remix-run/server-runtime"
import * as Tabs from "@radix-ui/react-tabs"

export const action = async ({ request }) => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const openai = new OpenAIApi(configuration)

  const formData = await request.formData()

  const recipeInput = formData.get("recipeInput")

  const baseHopPrompt = `From the recipe below, return a formatted list of the hops.
  Each hop must be in this form :
  - NAME, WEIGHT (convert in kg), TIME (in minutes), USE (could be Boil, HopStand, Dry Hop)
  Recipe :
  `

  //   const basePromptPrefix = `From this recipe, output a recipe in metric units. Then convert grams in kilograms.

  // The recipe :
  // `;

  const baseHopCompletion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `${baseHopPrompt}${recipeInput}\n`,
    temperature: 0.9,
    max_tokens: 200,
  })

  const baseHopPromptOutput = baseHopCompletion.data.choices.pop()

  const promptHopXml = `From the list of hops below, output a BeerXML file fragment in the form of <HOPS>...</HOPS>.
  Each hop must be in this form : 
  <HOP>
  <NAME>...</NAME>
  <AMOUNT>... (in kg)</AMOUNT>
  <FORM>...</FORM>
  <ALPHA>...(if alpha is unknown return a mean value, fixed integer without unit)</ALPHA>
  <TIME>...</TIME>
  <USE>...</USE>
  </HOP>
  
 List of hops : ${baseHopPromptOutput.text}
  `

  const hopsXmlCompletion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `${promptHopXml}\n`,
    temperature: 0.9,
    max_tokens: 500,
  })

  const hopsXmlOutput = hopsXmlCompletion.data.choices.pop()

  const baseGrainPrompt = `From the recipe below, return a formatted list of the fermentables. Do not include hops.
  Each fermentable must be in this form :
  - NAME, WEIGHT (converted in kg), COLOR (in SRM)
  Recipe :
  `

  const baseGrainCompletion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `${baseGrainPrompt}${recipeInput}\n`,
    temperature: 0.9,
    max_tokens: 200,
  })

  const baseGrainPromptOutput = baseGrainCompletion.data.choices.pop()

  const promptGrainXml = `From the list of fermentables below, output a BeerXML file fragment in the form of <FERMENTABLES>...</FERMENTABLES>.
  Each fermentable must be in this form : 
  <FERMENTABLE>
  <NAME>...</NAME>
  <AMOUNT>... (in kg)</AMOUNT>
  <TYPE>...(May be "Grain", "Sugar", "Extract", "Dry Extract" or "Adjunct". If type in unknown, use "Grain".)</TYPE>
  <YIELD>... (what is the  mean yield of this ingredient in percentage ? Return a fixed integer.)</YIELD>
  <COLOR>... (what is the mean color of this ingredient converted in srm ? Return a fixed integer.)</COLOR>
  </FERMENTABLE>
  
 List of fermentables : ${baseGrainPromptOutput.text}
`

  const grainXmlCompletion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `${promptGrainXml}\n`,
    temperature: 0.9,
    max_tokens: 500,
  })

  const grainXmlOutput = grainXmlCompletion.data.choices.pop()

  const volumePrompt = `Return the batch volume (in liters, do not include the unit in result) of the recipe  below.
  Recipe : ${recipeInput}
  `
  const volumeCompletion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `${volumePrompt}\n`,
    temperature: 0.9,
    max_tokens: 100,
  })

  const volumePromptOutput = volumeCompletion.data.choices.pop()

  console.log(volumePromptOutput.text)

  const finalXML = `
  <RECIPES>
    <RECIPE>
      <NAME>Just a dream</NAME>
      <BREWER>BullesAI</BREWER>
      <BATCH_SIZE>${volumePromptOutput.text}</BATCH_SIZE>
      <BOIL_TIME>60</BOIL_TIME>
      <STYLE>
        <NAME></NAME>
      </STYLE>
      ${grainXmlOutput.text}
      ${hopsXmlOutput.text}
      <MISCS></MISCS>
      <WATER></WATER>
      <NOTES>${recipeInput}</NOTES>
    </RECIPE>
  </RECIPES>
  `

  return json({
    baseGrainPromptOutput,
    baseHopPromptOutput,
    volumePromptOutput,
    finalXML,
  })
}

const inputClassName = `w-full rounded-xl border border-gray-100 px-2 py-1 text-lg`
const tabClassName = `px-2 font-bold data-[state=active]:border-b-2 data-[state=active]:border-black mr-8`

export default function Index() {
  const dreamText = useActionData()
  const navigation = useNavigation()
  const isCreating = Boolean(navigation.state === "submitting")

  return (
    <div className=" flex flex-1 flex-col justify-between">
      <header>
        <h1 className="mt-24 text-center text-6xl font-bold">BullesAI</h1>
      </header>
      <main className="relative pb-8">
        <div className=" mt-24 flex justify-center">
          <Form method="post" className="mr-24 w-1/3">
            <label htmlFor="recipeInput" className="block pb-6">
              Paste a recipe here 👇
            </label>
            <textarea
              id="recipeInput"
              rows={20}
              name="recipeInput"
              className={`${inputClassName} font-mono`}
            ></textarea>

            <p className="text-right">
              <button
                type="submit"
                disabled={isCreating}
                className="rounded bg-gray-900 py-2 px-4 text-white hover:bg-gray-600 focus:bg-gray-400 disabled:bg-gray-300"
              >
                {isCreating ? "Generating..." : "Generate  ✨"}
              </button>
            </p>
          </Form>
          <div className="h-48 w-1/3">
            <Tabs.Root defaultValue="tab1">
              <Tabs.List className="flex flex-1 flex-row pb-6">
                <Tabs.Trigger className={tabClassName} value="tab1">
                  Text
                </Tabs.Trigger>
                <Tabs.Trigger className={tabClassName} value="tab2">
                  BeerXML
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="tab1">
                {dreamText ? (
                  <>
                    <h2 className="pb-4 pt-8 text-xl">Batch volume</h2>
                    <pre className="whitespace-pre-wrap rounded-xl bg-slate-700 px-2 pb-3 text-white">
                      <code>
                        {dreamText
                          ? `${dreamText.volumePromptOutput.text} L`
                          : null}
                      </code>
                    </pre>
                    <h2 className=" pt-8 pb-4 text-xl">Fermentables</h2>
                    <pre className="min-h-full whitespace-pre-wrap rounded-xl bg-slate-700 px-2 py-1 text-white">
                      <code>
                        {dreamText
                          ? `${dreamText.baseGrainPromptOutput.text}`
                          : null}
                      </code>
                    </pre>
                    <h2 className="pt-8 pb-4 text-xl">Hops</h2>
                    <pre className="min-h-full whitespace-pre-wrap rounded-xl bg-slate-700 px-2 py-3 text-white">
                      <code>
                        {dreamText
                          ? `${dreamText.baseHopPromptOutput.text}`
                          : null}
                      </code>
                    </pre>
                  </>
                ) : null}
              </Tabs.Content>
              <Tabs.Content value="tab2">
                {dreamText ? (
                  <>
                    <pre className="whitespace-pre-wrap rounded-xl bg-slate-700 px-2 pb-3 text-white">
                      <code>{dreamText ? `${dreamText.finalXML}` : null}</code>
                    </pre>
                  </>
                ) : null}
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </div>
      </main>
      <footer className="mt-12 flex w-full justify-center pb-3 text-slate-500">
        a small POOC by joliebulle
      </footer>
    </div>
  )
}

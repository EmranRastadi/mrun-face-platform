import z from 'zod'


export const ResponseSchema = <T extends z.ZodTypeAny>(data: T) => z.object({
    success: z.literal(true),
    status: z.number(),
    message: z.string().nullish(),
    results: data
})
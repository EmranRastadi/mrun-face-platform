import z from "zod"
import {ResponseSchema} from "../utils/schemas";


export const UserSchema = z.object({
    username: z.string(),
    email: z.email().nullish(),
    password: z.string(),
    full_name: z.string().nullish()
})

export type UserType = z.infer<typeof UserSchema>


export const UsersResponseSchema = ResponseSchema(z.array(UserSchema))

export type UsersResponseType = z.infer<typeof UsersResponseSchema>
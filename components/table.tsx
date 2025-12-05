import React from 'react'
import { authFetch } from '../lib/auth';
interface Posts {
    userId: number;
    id: number;
    title: string;
    body: string;
}

const table = async () => {
    const res = await authFetch('https://jsonplaceholder.typicode.com/posts', {
        cache: 'no-store'
    });
    const data: Posts[] = await res.json();
    console.log(data);




    return (
        <table className="table-auto border-collapse border border-slate-400 w-full">
            <thead>
                <tr>
                    <th className="border border-slate-300 px-4 py-2">ID</th>
                    <th className="border border-slate-300 px-4 py-2">Title</th>
                </tr>
            </thead>
            <tbody>
                {data.map((post) => (
                    <tr key={post.id}>
                        <td className="border border-slate-300 px-4 py-2">{post.id}</td>
                        <td className="border border-slate-300 px-4 py-2">{post.title}</td>
                    </tr>
                ))}
            </tbody>
        </table>

    )
}

export default table

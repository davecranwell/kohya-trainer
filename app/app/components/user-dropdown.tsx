import { useUser } from '#app/utils/user.js';
import { Form, Link, useSubmit } from '@remix-run/react';
import { useRef } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

export function UserDropdown() {
    const user = useUser();
    const submit = useSubmit();
    const formRef = useRef<HTMLFormElement>(null);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button asChild variant="secondary">
                    <Link
                        to={`/users/${user.username}`}
                        // this is for progressive enhancement
                        onClick={(e) => e.preventDefault()}
                        className="flex items-center gap-2">
                        <span className="text-body-sm font-bold">{user.name ?? user.username}</span>
                    </Link>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent sideOffset={8} align="start">
                    <DropdownMenuItem asChild>
                        <Link prefetch="intent" to={`/users/${user.username}`}>
                            <Icon className="text-body-md" name="avatar">
                                Profile
                            </Icon>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link prefetch="intent" to={`/users/${user.username}/notes`}>
                            <Icon className="text-body-md" name="pencil-2">
                                Trainings
                            </Icon>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        asChild
                        // this prevents the menu from closing before the form submission is completed
                        onSelect={(event) => {
                            event.preventDefault();
                            submit(formRef.current);
                        }}>
                        <Form action="/logout" method="POST" ref={formRef}>
                            <Icon className="text-body-md" name="exit">
                                <button type="submit">Logout</button>
                            </Icon>
                        </Form>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
}

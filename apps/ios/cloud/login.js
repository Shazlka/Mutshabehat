import { createAuthClient } from '@neon/auth';

const auth = createAuthClient(document.body.dataset.issuer);
const form = document.querySelector('form');
const message = document.querySelector('[role=status]');
const buttons = [...document.querySelectorAll('button')];

async function run(action) {
  buttons.forEach(button => { button.disabled = true; });
  message.textContent = '';
  try {
    const result = await action();
    if (result?.error) message.textContent = result.error.message ?? 'Please try again.';
  } catch {
    message.textContent = 'Could not connect. Please try again.';
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function resume() {
  const session = await auth.getSession();
  if (session.data?.user) return auth.oauth2.continue({ selected: true });
  return session;
}

if (location.pathname === '/auth/consent') {
  for (const button of buttons) {
    button.onclick = () => run(() => auth.oauth2.consent({ accept: button.value === 'allow' }));
  }
} else {
  form.onsubmit = event => {
    event.preventDefault();
    const data = new FormData(form);
    run(async () => {
      const credentials = { email: data.get('email'), password: data.get('password') };
      if (event.submitter.value === 'signup') {
        const result = await auth.signUp.email({
          ...credentials,
          name: credentials.email.split('@')[0],
          callbackURL: location.href,
        });
        if (result.error) return result;
        if (!result.data?.token) {
          message.textContent = 'Check your email to verify your account, then sign in.';
          return;
        }
        return resume();
      }
      const result = await auth.signIn.email(credentials);
      if (result.error || result.data?.redirect) return result;
      return resume();
    });
  };
  document.querySelector('#google').onclick = () => run(() => auth.signIn.social({
    provider: 'google',
    callbackURL: location.href,
  }));
  run(resume);
}

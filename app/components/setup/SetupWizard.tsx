import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { DialogRoot, Dialog, DialogTitle, DialogButton, DialogClose } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { useSupabaseConnection } from '~/lib/hooks/useSupabaseConnection';
import { firebaseConfig, updateFirebaseConfig } from '~/lib/stores/firebase';

export function SetupWizard() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<'supabase' | 'firebase' | null>(null);
  const [step, setStep] = useState(1);

  const firebase = useStore(firebaseConfig);

  const {
    connection: supabaseConn,
    connecting,
    handleConnect,
    selectProject,
    fetchProjectApiKeys,
    updateToken,
  } = useSupabaseConnection();

  const startWizard = () => {
    setProvider(null);
    setStep(1);
    setOpen(true);
  };

  const handleFirebaseSave = () => {
    updateFirebaseConfig(firebase);
    setStep(3);
  };

  return (
    <div className="relative">
      <button
        className="px-3 py-1.5 rounded-md text-xs bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive"
        onClick={startWizard}
      >
        Setup Wizard
      </button>
      <DialogRoot open={open} onOpenChange={setOpen}>
        {open && (
          <Dialog className="max-w-[520px] p-6 space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <DialogTitle>Select a Provider</DialogTitle>
                <div className="flex gap-2">
                  <DialogButton
                    type="primary"
                    onClick={() => {
                      setProvider('supabase');
                      setStep(2);
                    }}
                  >
                    Supabase
                  </DialogButton>
                  <DialogButton
                    type="primary"
                    onClick={() => {
                      setProvider('firebase');
                      setStep(2);
                    }}
                  >
                    Firebase
                  </DialogButton>
                </div>
              </div>
            )}
            {provider === 'supabase' && step === 2 && (
              <div className="space-y-4">
                <DialogTitle>Connect Supabase</DialogTitle>
                <Input
                  placeholder="Supabase PAT"
                  value={supabaseConn.token}
                  onChange={(e) => updateToken(e.currentTarget.value)}
                />
                <DialogButton type="primary" onClick={handleConnect} disabled={connecting}>
                  {connecting ? 'Connecting...' : 'Connect'}
                </DialogButton>
                {supabaseConn.stats?.projects && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {supabaseConn.stats.projects.map((p) => (
                      <button
                        key={p.id}
                        className="block w-full text-left px-3 py-1 rounded hover:bg-bolt-elements-item-backgroundActive"
                        onClick={() => {
                          selectProject(p.id);
                          fetchProjectApiKeys(p.id).catch(console.error);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                {supabaseConn.credentials && (
                  <div className="space-y-2 text-xs bg-bolt-elements-background-depth-3 p-3 rounded">
                    <div>
                      Add these to your <code>.env.local</code>:
                    </div>
                    <pre>{`VITE_SUPABASE_URL=${supabaseConn.credentials.supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${supabaseConn.credentials.anonKey}`}</pre>
                    <div className="mt-2">Sample code:</div>
                    <pre>{`import { createClient } from '@supabase/supabase-js';\n\nexport const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);`}</pre>
                  </div>
                )}
              </div>
            )}
            {provider === 'firebase' && step === 2 && (
              <div className="space-y-4">
                <DialogTitle>Firebase Configuration</DialogTitle>
                <Input
                  placeholder="API Key"
                  value={firebase.apiKey}
                  onChange={(e) => updateFirebaseConfig({ apiKey: e.currentTarget.value })}
                />
                <Input
                  placeholder="Auth Domain"
                  value={firebase.authDomain}
                  onChange={(e) => updateFirebaseConfig({ authDomain: e.currentTarget.value })}
                />
                <Input
                  placeholder="Project ID"
                  value={firebase.projectId}
                  onChange={(e) => updateFirebaseConfig({ projectId: e.currentTarget.value })}
                />
                <DialogButton type="primary" onClick={handleFirebaseSave}>
                  Save
                </DialogButton>
              </div>
            )}
            {provider === 'firebase' && step === 3 && (
              <div className="space-y-2 text-xs bg-bolt-elements-background-depth-3 p-3 rounded">
                <div>
                  Add these to your <code>.env.local</code>:
                </div>
                <pre>{`VITE_FIREBASE_API_KEY=${firebase.apiKey}\nVITE_FIREBASE_AUTH_DOMAIN=${firebase.authDomain}\nVITE_FIREBASE_PROJECT_ID=${firebase.projectId}`}</pre>
                <div className="mt-2">Sample code:</div>
                <pre>{`import { initializeApp } from 'firebase/app';\nimport { getAuth } from 'firebase/auth';\nimport { getFirestore } from 'firebase/firestore';\n\nconst firebaseConfig = {\n  apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,\n  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN!,\n  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,\n};\n\nconst app = initializeApp(firebaseConfig);\nexport const auth = getAuth(app);\nexport const db = getFirestore(app);`}</pre>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <DialogButton type="secondary">Close</DialogButton>
              </DialogClose>
            </div>
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}

/** Scoped Foundry-styled confirmation window, no browser-native confirm().
 * Works in Foundry v11/v14 without depending on Dialog or DialogV2 APIs.
 */
export function confirmShopDialog(root,{title="Confirm",message="",confirmLabel="Confirm",danger=false}={}) {
 if(!root?.appendChild)throw new Error("Shop window must be open to confirm this action.");
 const doc=root.ownerDocument??globalThis.document;
 if(!doc?.createElement)throw new Error("Foundry window document unavailable");
 const overlay=doc.createElement("div");
 overlay.className="ns-confirm-overlay";
 overlay.setAttribute("role","presentation");
 const panel=doc.createElement("section");
 panel.className="ns-confirm-panel";
 panel.setAttribute("role","alertdialog");
 panel.setAttribute("aria-modal","true");
 panel.setAttribute("aria-label",String(title));
 const heading=doc.createElement("h3");
 heading.textContent=String(title);
 const description=doc.createElement("p");
 description.textContent=String(message);
 const actions=doc.createElement("div");
 actions.className="ns-confirm-buttons";
 const cancel=doc.createElement("button");
 cancel.type="button";cancel.textContent="Cancel";cancel.className="ns-confirm-cancel";
 const yes=doc.createElement("button");
 yes.type="button";yes.textContent=String(confirmLabel);
 yes.className=danger?"ns-confirm-yes is-danger":"ns-confirm-yes";
 actions.append(cancel,yes);
 panel.append(heading,description,actions);
 overlay.appendChild(panel);
 root.appendChild(overlay);
 return new Promise(resolve=>{
  let settled=false;
  const finish=approved=>{
   if(settled)return;
   settled=true;
   doc.removeEventListener?.("keydown",handleKey);
   overlay.remove();
   resolve(approved);
  };
  const handleKey=e=>{if(e.key==="Escape"){e.preventDefault?.();finish(false);}};
  doc.addEventListener?.("keydown",handleKey);
  overlay.addEventListener("click",e=>{if(e.target===overlay)finish(false);});
  cancel.addEventListener("click",()=>finish(false));
  yes.addEventListener("click",()=>finish(true));
  cancel.focus?.();
 });
}
